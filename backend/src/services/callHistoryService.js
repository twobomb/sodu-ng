const pool = require('../db/pool');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// История редактирования карточки вызова.
// Записи добавляются из контроллера вызовов при значимых действиях.
// ---------------------------------------------------------------------------

// Типы действий (используются и на фронтенде для оформления)
const ACTIONS = {
    CREATED: 'created',
    UPDATED: 'updated',
    STATUS: 'status',
    UNITS: 'units',
    EVENTS: 'events',
    ACCESS: 'access',
};

// Названия статусов вызова (совпадают с подписями в интерфейсе)
const STATUS_LABELS = {
    processing: 'Обрабатывается',
    closed: 'Закрыт',
    error: 'Ошибочный',
};

const statusNote = (status) =>
    `Статус изменён на «${STATUS_LABELS[status] || status}»`;

// Краткое перечисление названий: «АЦ-40, АЛ-30 и ещё 2»
const joinNames = (names, max = 3) => {
    const list = (names || []).filter(Boolean);
    if (!list.length) return '';
    if (list.length <= max) return list.join(', ');
    return `${list.slice(0, max).join(', ')} и ещё ${list.length - max}`;
};

/**
 * Добавляет запись в историю вызова.
 * Ошибка записи НЕ должна ломать основную операцию, поэтому она только
 * логируется (как и в истории входов).
 */
const addEntry = async ({ callId, userId, username, action, note }) => {
    if (!callId || !action) return null;
    try {
        let name = username;
        if (!name && userId) {
            const res = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            name = res.rows[0]?.username || null;
        }
        const res = await pool.query(
            `INSERT INTO call_history (call_id, user_id, username, action, note)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [callId, userId || null, name || null, action, note || null]
        );
        return res.rows[0];
    } catch (err) {
        logger.error(`Ошибка записи истории вызова ${callId}: ` + err.message, {
            stack: err.stack,
            action,
        });
        return null;
    }
};

// Записи вызова — от новых к старым
const listByCall = async (callId, limit = 500) => {
    const res = await pool.query(
        `SELECT id, call_id, user_id, username, action, note, created_at
         FROM call_history
         WHERE call_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [callId, limit]
    );
    return res.rows;
};

module.exports = {
    ACTIONS,
    STATUS_LABELS,
    statusNote,
    joinNames,
    addEntry,
    listByCall,
};
