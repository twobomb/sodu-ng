const onlineService = require('../services/onlineService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const getOnlineUsers = asyncHandler(async (req, res) => {
    try {
        const users = await onlineService.getOnlineUsersWithDetails();
        res.json(users);
    } catch (err) {
        logger.error('Ошибка получения онлайн-пользователей: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения онлайн-пользователей' });
    }
});

module.exports = { getOnlineUsers };