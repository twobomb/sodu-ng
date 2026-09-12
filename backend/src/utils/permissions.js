/**
 * Проверяет наличие правила у пользователя.
 * developer обходит все проверки.
 */
const hasPermission = (user, permission) => {
    if (!user) return false;
    if (user.role === 'developer') return true;
    const perms = user.permissions || [];
    return perms.includes(permission);
};

module.exports = { hasPermission };