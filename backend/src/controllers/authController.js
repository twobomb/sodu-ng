const { authenticateUser, createSession, deleteSessionByToken } = require('../services/authService');

/**
 * POST /api/auth/login
 * Тело: { username, password }
 */
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Требуется имя пользователя и пароль' });
    }

    const user = await authenticateUser(username, password);
    if (!user) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const session = await createSession(user.id);

    // Возвращаем данные пользователя и токен
    res.json({
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            can_view_all: user.can_view_all,
        },
        token: session.token,
    });
};

/**
 * POST /api/auth/logout
 * Требуется валидный токен (будет удалён)
 */
const logout = async (req, res) => {
    const token = req.token;
    if (token) {
        await deleteSessionByToken(token);
    }
    res.json({ message: 'Успешный выход из системы' });
};

/**
 * GET /api/auth/me
 * Возвращает данные текущего пользователя (из req.user, установленного middleware)
 */
const getMe = (req, res) => {
    res.json(req.user);
};

module.exports = {
    login,
    logout,
    getMe,
};