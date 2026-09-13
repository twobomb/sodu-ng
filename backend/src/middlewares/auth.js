const { verifyToken } = require('../utils/jwt');
const { touchSession } = require('../services/authService');
const pool = require('../db/pool');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Отсутствует или неверный токен' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }

    const session = await pool.query(
        'SELECT user_id FROM sessions WHERE token = $1',
        [token]
    );
    if (!session.rows.length) {
        return res.status(401).json({ error: 'Сессия истекла или не найдена' });
    }

    await touchSession(token);
    const userId = session.rows[0].user_id;

    const userResult = await pool.query(
        `
            SELECT
                u.id, u.username, u.role, u.can_view_all, u.is_blocked,
                r.name AS role_name, r.permissions,
                COALESCE(
                        (SELECT array_agg(department_id) FROM user_departments WHERE user_id = u.id),
                        '{}'::uuid[]
                ) AS department_ids
            FROM users u
                     LEFT JOIN roles r ON u.role = r.code
            WHERE u.id = $1
        `,
        [userId]
    );

    if (!userResult.rows.length) {
        return res.status(401).json({ error: 'Пользователь не найден' });
    }
    const u = userResult.rows[0];

    if (u.is_blocked) {
        return res.status(403).json({ error: 'Пользователь заблокирован' });
    }

    req.user = {
        id: u.id,
        username: u.username,
        role: u.role,
        role_name: u.role_name,
        can_view_all: u.can_view_all,
        permissions: u.permissions || [],
        department_ids: u.department_ids || [],
    };

    next();
};

module.exports = { authenticate };