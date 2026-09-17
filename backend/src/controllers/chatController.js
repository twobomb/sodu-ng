const chatService = require('../services/chatService');

const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { hasPermission } = require('../utils/permissions');
const Joi = require('joi');
const chatProfileService = require('../services/chatProfileService');
const pool = require('../db/pool');
const messageService = require('../services/messageService');

// ============================================================
// СХЕМЫ ВАЛИДАЦИИ
// ============================================================
const updateProfileSchema = Joi.object({
    display_name: Joi.string().allow('', null).max(100),
    avatar_url: Joi.string().allow('', null).max(500),
});
const createChannelSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().allow('', null).max(500),
    is_readonly: Joi.boolean().default(false),
    allow_member_invites: Joi.boolean().default(true),
    memberIds: Joi.array().items(Joi.string().uuid()).default([]),
});

const updateChannelSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().allow('', null).max(500),
    avatar_url: Joi.string().allow('', null).max(500),
    is_readonly: Joi.boolean(),
    allow_member_invites: Joi.boolean(),
});

const pinSchema = Joi.object({
    pinned: Joi.boolean().required(),
});

const addMemberSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    role: Joi.string().valid('member', 'admin').default('member'),
});
// ============================================================
// POST /api/chat/conversations/:id/transfer-admin
// Передать права администратора другому участнику
// ============================================================
const transferAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId: targetUserId } = req.body || {};
    const actorId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'Не указан пользователь' });
    }

    try {
        const conversation = await chatService.getConversationById(id, actorId);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        if (conversation.my_role !== 'admin') {
            return res.status(403).json({ error: 'Только администратор может передать права' });
        }
        if (targetUserId === actorId) {
            return res.status(400).json({ error: 'Нельзя передать права самому себе' });
        }

        const targetCheck = await pool.query(
            `SELECT 1 FROM conversation_members
       WHERE conversation_id = $1 AND user_id = $2`,
            [id, targetUserId]
        );
        if (!targetCheck.rows.length) {
            return res.status(400).json({ error: 'Пользователь не является участником' });
        }

        await pool.query(
            `UPDATE conversation_members
       SET role = 'member'
       WHERE conversation_id = $1 AND user_id = $2`,
            [id, actorId]
        );
        await pool.query(
            `UPDATE conversation_members
       SET role = 'admin'
       WHERE conversation_id = $1 AND user_id = $2`,
            [id, targetUserId]
        );

        // Имя нового админа
        const targetInfo = await pool.query(
            `SELECT u.username, p.display_name
       FROM users u
       LEFT JOIN user_chat_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
            [targetUserId]
        );
        const targetName =
            targetInfo.rows[0]?.display_name || targetInfo.rows[0]?.username;

        const sysMsg = await messageService.createSystemMessage({
            conversationId: id,
            actorId,
            content: `${targetName} назначен(а) администратором чата`,
        });
        const fullSysMsg = await messageService.getMessageById(sysMsg.id);

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${id}`).emit('chat:message', fullSysMsg);
            io.to(`conversation:${id}`).emit('chat:conversation_updated', { id });
        }

        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка передачи админки: ' + err.message, {
            stack: err.stack,
            user: actorId,
            conversationId: id,
        });
        res.status(500).json({ error: err.message || 'Ошибка передачи прав' });
    }
});

// ============================================================
// GET /api/chat/profile — мой профиль в чате
// ============================================================
const getMyProfile = asyncHandler(async (req, res) => {
    try {
        const profile = await chatProfileService.getProfile(req.user.id);
        res.json(profile);
    } catch (err) {
        logger.error('Ошибка получения профиля: ' + err.message, {
            stack: err.stack,
            user: req.user.id,
        });
        res.status(500).json({ error: 'Ошибка получения профиля' });
    }
});

// ============================================================
// PUT /api/chat/profile — обновить свой профиль
// ============================================================
const updateMyProfile = asyncHandler(async (req, res) => {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const profile = await chatProfileService.updateProfile(req.user.id, value);

        const io = req.app.get('io');
        if (io) {
            // Уведомляем всех, что профиль изменился
            io.emit('chat:profile_updated', {
                user_id: req.user.id,
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
            });
        }

        res.json(profile);
    } catch (err) {
        logger.error('Ошибка обновления профиля: ' + err.message, {
            stack: err.stack,
            user: req.user.id,
        });
        res.status(500).json({ error: 'Ошибка обновления профиля' });
    }
});

// ============================================================
// GET /api/chat/messages/:messageId/readers
// ============================================================
const getMessageReaders = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    try {
        const isMember = await chatService.isMember(
            (await pool.query('SELECT conversation_id FROM messages WHERE id = $1', [messageId])).rows[0]?.conversation_id,
            req.user.id
        );
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const result = await chatProfileService.getReaders(messageId);
        if (!result) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }
        res.json(result.readers);
    } catch (err) {
        logger.error('Ошибка получения прочитавших: ' + err.message, {
            stack: err.stack,
            user: req.user.id,
        });
        res.status(500).json({ error: 'Ошибка получения прочитавших' });
    }
});
// ============================================================
// GET /api/chat/conversations?filter=all|channels|chats
// ============================================================
const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        // Bootstrap: подписываем на общий, создаём избранное
        await chatService.bootstrapUser(userId);

        const filter = ['all', 'channels', 'chats'].includes(req.query.filter)
            ? req.query.filter
            : 'all';

        const conversations = await chatService.getUserConversations(userId, filter);
        res.json(conversations);
    } catch (err) {
        logger.error('Ошибка получения списка чатов: ' + err.message, {
            stack: err.stack,
            user: userId,
        });
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

// ============================================================
// GET /api/chat/conversations/:id
// ============================================================
const getConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const conversation = await chatService.getConversationById(id, userId);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден или нет доступа' });
        }

        // Для direct — подменяем name/avatar на данные второго участника
        if (conversation.type === 'direct') {
            const members = await chatService.getMembers(id);
            const peer = members.find((m) => m.user_id !== userId);
            if (peer) {
                conversation.name = peer.display_name || peer.username;
                conversation.avatar_url = peer.avatar_url;
                conversation.peer_user_id = peer.user_id;
            }
        }

        res.json(conversation);
    } catch (err) {
        logger.error('Ошибка получения чата: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка получения чата' });
    }
});

// ============================================================
// POST /api/chat/conversations  — создать канал/группу
// ============================================================
const createChannel = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { error, value } = createChannelSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const conversation = await chatService.createChannel(value, userId);

        const io = req.app.get('io');
        if (io) {
            // Всех участников — в комнату нового чата
            const allIds = [...new Set([userId, ...value.memberIds])];
            for (const uid of allIds) {
                io.in(`user:${uid}`).socketsJoin(`conversation:${conversation.id}`);
                io.to(`user:${uid}`).emit('chat:conversation_created', conversation);
            }
            io.emit('chat:conversation_list_dirty', {
                conversation_id: conversation.id,
            });
        }

        res.status(201).json(conversation);
    } catch (err) {
        logger.error('Ошибка создания канала: ' + err.message, {
            stack: err.stack,
            user: userId,
            body: req.body,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания канала' });
    }
});

// ============================================================
// PUT /api/chat/conversations/:id
// ============================================================
const updateChannel = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const { error, value } = updateChannelSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const conversation = await chatService.getConversationById(id, userId);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        if (conversation.is_system) {
            return res.status(400).json({ error: 'Системный чат нельзя изменить' });
        }

        // Права: создатель (admin) или chat.update_channel
        const isAdmin = conversation.my_role === 'admin';
        const canUpdate = hasPermission(req.user, 'chat.update_channel');
        if (!isAdmin && !canUpdate) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        const updated = await chatService.updateChannel(id, value);

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${id}`).emit('chat:conversation_updated', updated);
            io.emit('chat:conversation_list_dirty', { conversation_id: id });
        }

        res.json(updated);
    } catch (err) {
        logger.error('Ошибка обновления канала: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: err.message || 'Ошибка обновления' });
    }
});

// ============================================================
// DELETE /api/chat/conversations/:id
// ============================================================
const deleteChannel = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const conversation = await chatService.getConversationById(id, userId);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        if (conversation.is_system) {
            return res.status(400).json({ error: 'Системный чат нельзя удалить' });
        }

        const isAdmin = conversation.my_role === 'admin';
        const canDelete = hasPermission(req.user, 'chat.delete_channel');
        if (!isAdmin && !canDelete) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        const members = await chatService.getMembers(id);

        const deleted = await chatService.deleteChannel(id);
        if (!deleted) {
            return res.status(400).json({ error: 'Не удалось удалить чат' });
        }

        const io = req.app.get('io');
        if (io) {
            // Уведомляем всех и выгоняем из комнаты
            for (const m of members) {
                io.to(`user:${m.user_id}`).emit('chat:conversation_deleted', {
                    conversation_id: id,
                });
                io.in(`user:${m.user_id}`).socketsLeave(`conversation:${id}`);
            }
            io.emit('chat:conversation_list_dirty', { conversation_id: id });
        }

        res.json({ message: 'Чат удалён' });
    } catch (err) {
        logger.error('Ошибка удаления канала: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления' });
    }
});

// ============================================================
// POST /api/chat/conversations/:id/pin
// ============================================================
const pinConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const { error, value } = pinSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const isMember = await chatService.isMember(id, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const result = await chatService.pinConversation(id, userId, value.pinned);
        if (!result.ok) {
            const messages = {
                not_found: 'Чат не найден',
                limit_reached: `Достигнут лимит закреплённых (${result.limit})`,
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${userId}`).emit('chat:conversation_list_dirty', {
                conversation_id: id,
            });
        }

        res.json({ pinned: value.pinned });
    } catch (err) {
        logger.error('Ошибка закрепления: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка закрепления' });
    }
});

// ============================================================
// GET /api/chat/conversations/:id/members
// ============================================================
const getMembers = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const isMember = await chatService.isMember(id, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        const members = await chatService.getMembers(id);
        res.json(members);
    } catch (err) {
        logger.error('Ошибка получения участников: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка получения участников' });
    }
});
// ============================================================
// GET /api/chat/users?q=...
// Все пользователи, доступные для личного чата
// ============================================================
const getChattableUsers = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const q = (req.query.q || '').trim();

    try {
        const users = await chatService.getChattableUsers(userId, q);
        res.json(users);
    } catch (err) {
        logger.error('Ошибка получения пользователей чата: ' + err.message, {
            stack: err.stack,
            user: userId,
        });
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});
// ============================================================
// POST /api/chat/conversations/:id/members
// ============================================================
const addMember = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const { error, value } = addMemberSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const conversation = await chatService.getRawConversation(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден' });
        }
        if (conversation.type !== 'channel') {
            return res.status(400).json({
                error: 'Добавлять участников можно только в каналы и группы',
            });
        }

        const canManage = hasPermission(req.user, 'chat.manage_members');
        const inviteCheck = await chatService.canInvite(id, userId, canManage);
        // ... остальное без изменений

        if (!inviteCheck.ok) {
            const messages = {
                not_found: 'Чат не найден',
                not_member: 'Вы не участник этого чата',
                forbidden: 'Приглашать участников может только администратор',
            };
            const status = inviteCheck.reason === 'not_found' ? 404 : 403;
            return res.status(status).json({ error: messages[inviteCheck.reason] });
        }

        const member = await chatService.addMember(id, value.userId, value.role);

        // Данные добавленного
        const members = await chatService.getMembers(id);
        const added = members.find((m) => m.user_id === value.userId);

        // Данные актора (с учётом chat-профиля)
        const actorInfo = await pool.query(
            `SELECT u.username, p.display_name
       FROM users u
       LEFT JOIN user_chat_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
            [userId]
        );
        const actorName = actorInfo.rows[0]?.display_name || actorInfo.rows[0]?.username;
        const targetName = added?.display_name || added?.username || 'пользователя';

        // Системное сообщение
        const sysMsg = await messageService.createSystemMessage({
            conversationId: id,
            actorId: userId,
            content: `${actorName} добавил(а) ${targetName} в чат`,
        });
        const fullSysMsg = await messageService.getMessageById(sysMsg.id);

        const io = req.app.get('io');
        if (io) {
            const conversation = await chatService.getConversationById(id, userId);
            io.in(`user:${value.userId}`).socketsJoin(`conversation:${id}`);
            io.to(`user:${value.userId}`).emit('chat:conversation_created', conversation);
            io.to(`conversation:${id}`).emit('chat:member_added', {
                conversation_id: id,
                member: added,
            });
            io.to(`conversation:${id}`).emit('chat:message', fullSysMsg);
            io.to(`conversation:${id}`).emit('chat:conversation_updated', { id });
            io.emit('chat:conversation_list_dirty', { conversation_id: id });
        }

        res.status(201).json(member);
    } catch (err) {
        logger.error('Ошибка добавления участника: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: err.message || 'Ошибка добавления' });
    }
});
// ============================================================
// POST /api/chat/conversations/:id/leave
// Выйти из личного чата (убрать из своего списка)
// ============================================================
const leaveConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const result = await chatService.leaveDirectConversation(id, userId);

        if (!result.ok) {
            const messages = {
                not_found: 'Чат не найден',
                not_direct: 'Выйти можно только из личного чата',
            };
            const status = result.reason === 'not_found' ? 404 : 400;
            return res.status(status).json({ error: messages[result.reason] });
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('chat:conversation_list_dirty', { conversation_id: id });
        }

        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка выхода из чата: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка выхода из чата' });
    }
});
// ============================================================
// GET /api/chat/conversations/:id/invitable
// Возвращает пользователей, ещё не состоящих в чате
// ============================================================
const getInvitableUsers = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const q = (req.query.q || '').trim();

    try {
        const isMember = await chatService.isMember(id, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const canManage = hasPermission(req.user, 'chat.manage_members');
        const inviteCheck = await chatService.canInvite(id, userId, canManage);
        if (!inviteCheck.ok) {
            return res.status(403).json({ error: 'Нет прав приглашать' });
        }

        const users = await chatService.getInvitableUsers(id, q);
        res.json(users);
    } catch (err) {
        logger.error('Ошибка получения приглашаемых: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка получения' });
    }
});
// ============================================================
// DELETE /api/chat/conversations/:id/members/:memberId
// ============================================================
const removeMember = asyncHandler(async (req, res) => {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    try {
        const conversation = await chatService.getConversationById(id, userId);
        if (!conversation) {
            return res.status(404).json({ error: 'Чат не найден' });
        }

        const isAdmin = conversation.my_role === 'admin';
        const canManage = hasPermission(req.user, 'chat.manage_members');
        const isSelf = memberId === userId;

        if (!isSelf && !isAdmin && !canManage) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Информация об удаляемом до удаления
        const members = await chatService.getMembers(id);
        const removed = members.find((m) => m.user_id === memberId);
        if (!removed) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        // Информация об акторе
        const actorInfo = await pool.query(
            `SELECT u.username, p.display_name
       FROM users u
       LEFT JOIN user_chat_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
            [userId]
        );
        const actorName = actorInfo.rows[0]?.display_name || actorInfo.rows[0]?.username;

        const ok = await chatService.removeMember(id, memberId);
        if (!ok) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        const targetName = removed.display_name || removed.username;

        // Системное сообщение
        const text = isSelf
            ? `${targetName} покинул(а) чат`
            : `${actorName} удалил(а) ${targetName} из чата`;

        const sysMsg = await messageService.createSystemMessage({
            conversationId: id,
            actorId: userId,
            content: text,
        });
        const fullSysMsg = await messageService.getMessageById(sysMsg.id);

        const io = req.app.get('io');
        if (io) {
            io.in(`user:${memberId}`).socketsLeave(`conversation:${id}`);
            io.to(`user:${memberId}`).emit('chat:conversation_removed', {
                conversation_id: id,
            });
            io.to(`conversation:${id}`).emit('chat:message', fullSysMsg);
            io.to(`conversation:${id}`).emit('chat:conversation_updated', { id });
            io.emit('chat:conversation_list_dirty', { conversation_id: id });
        }

        res.json({ message: 'Участник удалён' });
    } catch (err) {
        logger.error('Ошибка удаления участника: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
            memberId,
        });
        res.status(500).json({ error: err.message || 'Ошибка удаления' });
    }
});
// ============================================================
// POST /api/chat/direct/:userId — создать личный чат
// ============================================================
const createDirect = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { userId: peerId } = req.params;

    try {
        const conversationId = await chatService.getOrCreateDirect(userId, peerId);
        const conversation = await chatService.getConversationById(conversationId, userId);

        const io = req.app.get('io');
        if (io) {
            io.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
            io.in(`user:${peerId}`).socketsJoin(`conversation:${conversationId}`);
            io.to(`user:${userId}`).emit('chat:conversation_created', conversation);
            io.to(`user:${peerId}`).emit('chat:conversation_created', conversation);
        }

        res.status(201).json({ id: conversationId });
    } catch (err) {
        logger.error('Ошибка создания личного чата: ' + err.message, {
            stack: err.stack,
            user: userId,
            peerId,
        });
        res.status(500).json({ error: err.message || 'Ошибка создания чата' });
    }
});

// ============================================================
// GET /api/chat/search?q=...
// ============================================================
const searchConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
        return res.json([]);
    }

    try {
        const results = await chatService.searchConversations(userId, q);
        res.json(results);
    } catch (err) {
        logger.error('Ошибка поиска чатов: ' + err.message, {
            stack: err.stack,
            user: userId,
        });
        res.status(500).json({ error: 'Ошибка поиска' });
    }
});

// ============================================================
// POST /api/chat/conversations/:id/read — пометить прочитанным
// (REST-дубль для случаев, когда сокет не подключён)
// ============================================================
const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { messageId } = req.body || {};
    const userId = req.user.id;

    try {
        const isMember = await chatService.isMember(id, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        await chatService.markAsRead(id, userId, messageId || null);

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${id}`).emit('chat:read', {
                conversation_id: id,
                user_id: userId,
                last_read_message_id: messageId || null,
                last_read_at: new Date().toISOString(),
            });
        }

        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка отметки прочтения: ' + err.message, {
            stack: err.stack,
            user: userId,
            conversationId: id,
        });
        res.status(500).json({ error: 'Ошибка отметки' });
    }
});

// ============================================================
// POST /api/chat/read-all — отметить все чаты прочитанными
// ============================================================
const markAllRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    try {
        await chatService.markAllRead(userId);
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${userId}`).emit('chat:read_all');
        }
        res.json({ ok: true });
    } catch (err) {
        logger.error('Ошибка отметки всех чатов прочитанными: ' + err.message, {
            stack: err.stack,
            user: userId,
        });
        res.status(500).json({ error: 'Ошибка отметки' });
    }
});
module.exports = {
    getConversations,
    getConversation,
    createChannel,
    updateChannel,
    deleteChannel,
    getChattableUsers,
    pinConversation,
    getMembers,
    addMember,
    removeMember,
    createDirect,
    searchConversations,
    leaveConversation,
    markAsRead,
    markAllRead,
    getMyProfile,
    transferAdmin,
    updateMyProfile,
    getMessageReaders,
    getInvitableUsers
};