const pool = require('../db/pool');
const chatService = require('../services/chatService');
const messageService = require('../services/messageService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Joi = require('joi');

const reportBugSchema = Joi.object({
    message: Joi.string().min(5).max(5000).required(),
    context: Joi.string().max(500).allow('', null),
});

/**
 * POST /api/reports/bug
 * Тело: { message, context }
 * Находит developer'а, создаёт/находит личный чат с ним,
 * кладёт туда сообщение от лица пользователя.
 * Возвращает conversation_id, чтобы фронт открыл этот чат.
 */
const reportBug = asyncHandler(async (req, res) => {
    const { error, value } = reportBugSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // 1. Ищем developer'а (первого)
        const devRes = await pool.query(
            `SELECT id, username FROM users
       WHERE role = 'developer' AND is_blocked = false
       ORDER BY created_at ASC
       LIMIT 1`
        );

        if (!devRes.rows.length) {
            return res.status(404).json({
                error: 'Разработчик не найден. Обратитесь к администратору.',
            });
        }

        const developer = devRes.rows[0];
        const userId = req.user.id;

        if (developer.id === userId) {
            return res
                .status(400)
                .json({ error: 'Вы и есть разработчик — обратитесь к себе в чат.' });
        }

        // 2. Находим или создаём личный чат
        const conversationId = await chatService.getOrCreateDirect(
            userId,
            developer.id
        );

        // 3. Формируем текст сообщения
        const context = value.context ? `\n\n[Контекст: ${value.context}]` : '';
        const content = `🐞 Сообщение об ошибке:\n\n${value.message}${context}`;

        // 4. Создаём сообщение в БД
        const message = await messageService.createMessage({
            conversationId,
            userId,
            content,
            contentType: 'text',
            replyToId: null,
            attachmentIds: [],
        });

        // 5. Достаём полное сообщение (с аватаром, именем)
        const full = await messageService.getMessageById(message.id);

        // 6. Рассылаем участникам через сокет
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${conversationId}`).emit('chat:message', full);
            io.to(`conversation:${conversationId}`).emit('chat:conversation_updated', {
                conversation_id: conversationId,
            });
            io.emit('chat:conversation_list_dirty', {
                conversation_id: conversationId,
            });
        }

        logger.info(
            `Сообщение об ошибке от ${req.user.username} отправлено developer'у ${developer.username}`,
            { userId, developerId: developer.id, conversationId }
        );

        res.status(201).json({
            ok: true,
            conversation_id: conversationId,
            developer_username: developer.username,
        });
    } catch (err) {
        logger.error('Ошибка отправки bug report: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
            body: req.body,
        });
        res.status(500).json({ error: 'Ошибка отправки. Попробуйте позже.' });
    }
});

module.exports = { reportBug };