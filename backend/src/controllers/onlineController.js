const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// ---------- Получение списка онлайн-пользователей ----------
const getOnlineUsers = asyncHandler(async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        u.id, u.username, u.role,
        s.last_active_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.last_active_at > NOW() - INTERVAL '5 minutes'
      ORDER BY s.last_active_at DESC
    `);
        res.json(result.rows);
    } catch (err) {
        logger.error('Ошибка получения онлайн-пользователей: ' + err.message, {
            stack: err.stack,
            user: req.user?.id,
        });
        res.status(500).json({ error: 'Ошибка получения онлайн-пользователей' });
    }
});

module.exports = { getOnlineUsers };