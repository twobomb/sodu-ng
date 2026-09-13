const pool = require('../db/pool');
const logger = require('../utils/logger');

// Реестр: userId -> Set<socketId>
const onlineSockets = new Map();

const registerSocket = (userId, socketId) => {
    if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
    onlineSockets.get(userId).add(socketId);
};

// Возвращает true, если у пользователя больше нет сокетов
const unregisterSocket = (userId, socketId) => {
    const set = onlineSockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
        onlineSockets.delete(userId);
        return true;
    }
    return false;
};

const getOnlineUserIds = () => Array.from(onlineSockets.keys());

// Полный список онлайн-пользователей с деталями
const getOnlineUsersWithDetails = async () => {
    const ids = getOnlineUserIds();
    if (ids.length === 0) return [];

    const result = await pool.query(
        `SELECT
       u.id, u.username, u.role,
       r.name AS role_name,
       p.display_name, p.avatar_url,
       NOW() AS last_active_at
     FROM users u
     LEFT JOIN roles r ON u.role = r.code
     LEFT JOIN user_chat_profiles p ON p.user_id = u.id
     WHERE u.id = ANY($1::uuid[])
     ORDER BY COALESCE(p.display_name, u.username) ASC`,
        [ids]
    );
    return result.rows;
};

module.exports = {
    onlineSockets,
    registerSocket,
    unregisterSocket,
    getOnlineUserIds,
    getOnlineUsersWithDetails,
};