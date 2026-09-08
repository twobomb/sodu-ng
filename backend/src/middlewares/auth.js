const { verifyToken } = require('../utils/jwt');
const { touchSession } = require('../services/authService');
const pool = require('../db/pool');

/**
 * Middleware: проверяет наличие и валидность JWT, обновляет last_active_at
 */
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Проверяем, существует ли сессия с таким токеном в БД
    const session = await pool.query(
        'SELECT user_id, last_active_at FROM sessions WHERE token = $1',
        [token]
    );
    if (!session.rows.length) {
        return res.status(401).json({ error: 'Session expired or not found' });
    }

    // Обновляем время последней активности
    await touchSession(token);

    // Загружаем пользователя
    const userId = session.rows[0].user_id;
    const userResult = await pool.query(
        'SELECT id, username, role, can_view_all FROM users WHERE id = $1',
        [userId]
    );
    if (!userResult.rows.length) {
        return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    req.token = token;
    next();
};

module.exports = { authenticate };