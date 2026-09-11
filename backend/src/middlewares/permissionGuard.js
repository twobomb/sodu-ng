/**
 * Проверяет наличие конкретного правила у пользователя.
 * Роль developer игнорирует все проверки.
 * @param {string} permission - ключ правила, например 'departments.create'
 */
const requirePermission = (permission) => (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    // Developer обходит все правила
    if (user.role === 'developer') return next();

    const perms = user.permissions || [];
    if (!perms.includes(permission)) {
        return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
};

module.exports = { requirePermission };