/**
 * Middleware для проверки, что пользователь имеет одну из разрешённых ролей.
 * @param {string|string[]} allowedRoles - одна роль или массив ролей
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
};

module.exports = { requireRole };