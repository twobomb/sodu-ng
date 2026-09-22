const chatService = require('../services/chatService');
const messageService = require('../services/messageService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { emitForceRefresh } = require('../utils/socketEvents');
const { hasPermission } = require('../utils/permissions');
const Joi = require('joi');
const pool = require('../db/pool');

const createMessageSchema = Joi.object({
    content: Joi.string().allow('', null).max(10000),
    content_type: Joi.string().valid('text', 'file', 'image').default('text'),
    reply_to_id: Joi.string().uuid().allow(null),
    attachment_ids: Joi.array().items(Joi.string().uuid()).default([]),
}).custom((value, helpers) => {
    if (value.content_type === 'text' && !value.content?.trim()) {
        return helpers.error('any.invalid', {
            message: 'Текст сообщения не может быть пустым',
        });
    }
    return value;
});

const editMessageSchema = Joi.object({
    content: Joi.string().min(1).max(10000).required(),
});

// ============================================================
// GET /api/chat/conversations/:id/messages
// Query: ?before=<iso>&before_id=<uuid>&limit=30
// ============================================================
const getMessages = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    try {
        // Проверяем членство
        const isMember = await chatService.isMember(conversationId, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа к этому чату' });
        }

        const limit = Math.min(Number(req.query.limit) || 30, 100);
        let before = null;
        if (req.query.before && req.query.before_id) {
            before = {
                created_at: req.query.before,
                id: req.query.before_id,
            };
        }

        const result = await messageService.getMessages(conversationId, {
            before,
            limit,
        });

        res.json(result);
    } catch (err) {
        logger.error('Ошибка получения сообщений: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId,
        });
        res.status(500).json({ error: 'Ошибка получения сообщений' });
    }
});

// ============================================================
// POST /api/chat/conversations/:id/messages
// ============================================================
const createMessage = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    const { error, value } = createMessageSchema.validate(req.body);
    if (error) {
        const msg = error.details[0].type === 'any.invalid'
            ? error.details[0].context.message
            : error.details[0].message;
        return res.status(400).json({ error: msg });
    }

    try {
        const conversation = await chatService.getConversationById(
            conversationId,
            userId
        );
        if (!conversation) {
            return res.status(403).json({ error: 'Нет доступа к этому чату' });
        }

        // Проверка "только чтение" для каналов
        if (conversation.is_readonly) {
            const isAdmin = conversation.my_role === 'admin';
            const canModerate = hasPermission(req.user, 'chat.moderate');
            if (!isAdmin && !canModerate) {
                return res.status(403).json({ error: 'Канал работает в режиме только для чтения' });
            }
        }

        const message = await messageService.createMessage({
            conversationId,
            userId,
            content: value.content,
            contentType: value.content_type,
            replyToId: value.reply_to_id || null,
            attachmentIds: value.attachment_ids,
        });

        const full = await messageService.getMessageById(message.id);

        // Рассылаем всем участникам
        const io = req.app.get('io');

        // Отправитель автоматически "прочитал" своё сообщение
        await pool.query(
            `INSERT INTO message_reads (conversation_id, user_id, last_read_message_id, last_read_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (conversation_id, user_id) DO UPDATE
           SET last_read_message_id = $3,
               last_read_at = NOW()`,
                    [conversationId, userId, message.id]
                );

                await pool.query(
                    `UPDATE conversation_members
           SET last_read_at = NOW()
           WHERE conversation_id = $1 AND user_id = $2`,
                    [conversationId, userId]
                );
        if (io) {
            io.emit('chat:message', full);
            // Обновляем список чатов у всех, кто не в комнате.
            // Отдельное chat:conversation_updated в комнату не слаем — у членов
            // комнаты список и так обновится через chat:message (на фронте он
            // помечает список "грязным"), а ради нечленов комнаты broadcast ниже.
            // список чатов клиент обновляет сам из chat:message (setQueryData, без refetch — меньше шторма при росте числа пользователей)
        }

        res.status(201).json(full);
    } catch (err) {
        logger.error('Ошибка создания сообщения: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания сообщения' });
    }
});

// ============================================================
// PUT /api/chat/messages/:messageId
// ============================================================
const editMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    const { error, value } = editMessageSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const editWindow = await messageService.getEditWindowMinutes();
        const result = await messageService.editMessage(
            messageId,
            userId,
            value.content,
            editWindow
        );

        if (!result.ok) {
            const messages = {
                not_found: 'Сообщение не найдено',
                deleted: 'Сообщение удалено',
                forbidden: 'Можно редактировать только свои сообщения',
                not_text: 'Редактировать можно только текстовые сообщения',
                expired: `Время редактирования истекло (${result.limit} мин)`,
            };
            const status =
                result.reason === 'not_found' ? 404 :
                    result.reason === 'forbidden' ? 403 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const full = await messageService.getMessageById(messageId);

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${full.conversation_id}`).emit('chat:message_edited', full);
        }

        res.json(full);
    } catch (err) {
        logger.error('Ошибка редактирования: ' + err.message, {
            stack: err.stack,
            user: userId,
            messageId,
        });
        res.status(500).json({ error: err.message || 'Ошибка редактирования' });
    }
});

// ============================================================
// DELETE /api/chat/messages/:messageId
// ============================================================
const deleteMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
    const canModerate = hasPermission(req.user, 'chat.moderate');

    try {
        const result = await messageService.deleteMessage(messageId, userId, canModerate);

        if (!result.ok) {
            const messages = {
                not_found: 'Сообщение не найдено',
                forbidden: 'Можно удалять только свои сообщения',
            };
            const status = result.reason === 'not_found' ? 404 : 403;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${result.message.conversation_id}`).emit(
                'chat:message_deleted',
                { id: result.message.id, conversation_id: result.message.conversation_id }
            );
            io.emit('chat:conversation_list_dirty', {
                conversation_id: result.message.conversation_id,
            });
        }

        res.json({ message: 'Сообщение удалено' });
    } catch (err) {
        logger.error('Ошибка удаления: ' + err.message, {
            stack: err.stack,
            user: userId,
            messageId,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления' });
    }
});

// ============================================================
// GET /api/chat/messages/:messageId/readers
// ============================================================
const getMessageReaders = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    try {
        const result = await messageService.getMessageReaders(messageId);
        if (!result) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }

        // Только участники могут смотреть
        const isMember = await chatService.isMember(result.conversation_id, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        res.json(result.readers);
    } catch (err) {
        logger.error('Ошибка получения прочитавших: ' + err.message, {
            stack: err.stack,
            user: userId,
            messageId,
        });
        res.status(500).json({ error: 'Ошибка получения прочитавших' });
    }
});

module.exports = {
    getMessages,
    createMessage,
    editMessage,
    deleteMessage,
    getMessageReaders,
};