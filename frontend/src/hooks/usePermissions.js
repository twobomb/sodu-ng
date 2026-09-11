import { useAuth } from '../context/AuthContext';

/**
 * Хук для проверки прав текущего пользователя.
 *  - isDeveloper всегда true для роли developer (обходит все проверки)
 *  - has('xxx.yyy') — есть ли конкретное право
 *  - hasAny([...]) — есть ли хотя бы одно
 *  - hasAll([...]) — есть ли все
 */
export const usePermissions = () => {
    const { user } = useAuth();

    const isDeveloper = user?.role === 'developer';
    const permissions = user?.permissions || [];

    const has = (perm) => {
        if (isDeveloper) return true;
        return permissions.includes(perm);
    };

    const hasAny = (list) => {
        if (isDeveloper) return true;
        return list.some((p) => permissions.includes(p));
    };

    const hasAll = (list) => {
        if (isDeveloper) return true;
        return list.every((p) => permissions.includes(p));
    };

    return { has, hasAny, hasAll, isDeveloper, permissions };
};