const pool = require('../db/pool');

const getOnlineUsers = async (req, res) => {
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
        res.status(500).json({ error: 'Ошибка получения онлайн-пользователей' });
    }
};

module.exports = { getOnlineUsers };