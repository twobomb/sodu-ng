const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// КОНСТАНТЫ
// ============================================================
const CALL_TYPES = [
    'Пожар',
    'АПС',
    'АСР',
    'ДТП',
    'Помощь',
    'ЛОХ',
    'ПСП',
    'ПТУ',
    'Хоз. Работы',
];

const CALL_RANKS = [
    'Ранг №1',
    'Ранг №1-БИС',
    'Ранг №2',
    'Ранг №3',
    'Ранг №4',
    'Ранг №5',
];

const CALL_STATUSES = ['processing', 'closed', 'error'];

// ============================================================
// ОБЩАЯ ЧАСТЬ SELECT
// ============================================================
const SELECT_CALL_BASE = `
  c.id, c.status, c.type, c.rank,
  c.incident_at, c.message_received_at, c.municipality, c.address,
  c.dispatch_at, c.arrival_at,
  c.localization_at, c.open_fire_eliminated_at, c.fire_eliminated_at,
  c.description, c.created_by, c.created_at, c.updated_at,
  u.username AS creator_username
`;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================
const getUserDepartmentIds = async (userId) => {
    const res = await pool.query(
        `SELECT department_id FROM user_departments WHERE user_id = $1`,
        [userId]
    );
    return res.rows.map((row) => row.department_id);
};

const getCallUnits = async (callId) => {
    const res = await pool.query(
        `SELECT cu.unit_id, u.name AS unit_name, u.plate_number, u.department_id,
                     d.name AS department_name, t.short_name AS type_short_name
         FROM call_units cu
         LEFT JOIN units u ON cu.unit_id = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN unit_types t ON u.type_id = t.id
         WHERE cu.call_id = $1
         ORDER BY d.name, u.name`,
        [callId]
    );
    return res.rows;
};

const getCallEvents = async (callId) => {
    const res = await pool.query(
        `SELECT ce.id, ce.call_id, ce.event_at, ce.text, ce.created_by, ce.created_at,
                        u.username AS author_username
         FROM call_events ce
         LEFT JOIN users u ON ce.created_by = u.id
         WHERE ce.call_id = $1
         ORDER BY ce.event_at ASC, ce.created_at ASC`,
        [callId]
    );
    return res.rows;
};

// ============================================================
// СПИСОК (статус error везде игнорируем)
// ============================================================
const getCalls = async (filters = {}) => {
    const conds = [`c.status <> 'error'`];
    const params = [];
    let i = 1;

    if (filters.status && filters.status !== 'all') {
        conds.push(`c.status = $${i++}`);
        params.push(filters.status);
    }
    if (filters.type && filters.type !== 'all') {
        conds.push(`c.type = $${i++}`);
        params.push(filters.type);
    }
    if (filters.search) {
        conds.push(
            `(c.address ILIKE $${i} OR c.municipality ILIKE $${i} OR c.description ILIKE $${i})`
        );
        params.push(`%${filters.search}%`);
        i++;
    }
    if (filters.date_from) {
        conds.push(`c.incident_at >= $${i++}`);
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        conds.push(`c.incident_at <= $${i++}`);
        params.push(filters.date_to);
    }

    const where = `WHERE ${conds.join(' AND ')}`;

    const res = await pool.query(
        `SELECT ${SELECT_CALL_BASE},
                    (SELECT count(*)::int FROM call_units cu WHERE cu.call_id = c.id)  AS units_count,
                    (SELECT count(*)::int FROM call_events ce WHERE ce.call_id = c.id) AS events_count
         FROM calls c
         LEFT JOIN users u ON c.created_by = u.id
         ${where}
         ORDER BY c.created_at DESC`,
        params
    );
    return res.rows;
};

const getCallById = async (id) => {
    const res = await pool.query(
        `SELECT ${SELECT_CALL_BASE}
         FROM calls c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.id = $1`,
        [id]
    );
    if (!res.rows.length) return null;

    const call = res.rows[0];
    call.units = await getCallUnits(id);
    call.events = await getCallEvents(id);
    return call;
};

// ============================================================
// СОЗДАНИЕ — новый вызов с пустыми полями
// ============================================================
const createCall = async (userId) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO calls (id, status, created_by)
         VALUES ($1, 'processing', $2)
         RETURNING *`,
        [id, userId]
    );
    const call = res.rows[0];
    call.units = [];
    call.events = [];
    return call;
};

// ============================================================
// ОБНОВЛЕНИЕ ПОЛЕЙ
// ============================================================
const UPDATE_COLUMNS = [
    'type',
    'rank',
    'incident_at',
    'message_received_at',
    'municipality',
    'address',
    'dispatch_at',
    'arrival_at',
    'localization_at',
    'open_fire_eliminated_at',
    'fire_eliminated_at',
    'description',
];

const updateCall = async (id, data) => {
    const fields = [];
    const params = [];
    let i = 1;

    for (const col of UPDATE_COLUMNS) {
        if (data[col] !== undefined) {
            fields.push(`${col} = $${i++}`);
            params.push(data[col] === '' ? null : data[col]);
        }
    }

    if (!fields.length) return getCallById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const res = await pool.query(
        `UPDATE calls SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`,
        params
    );
    if (!res.rows.length) return null;
    return getCallById(id);
};

// ============================================================
// СМЕНА СТАТУСА
// ============================================================
const setCallStatus = async (id, status) => {
    const res = await pool.query(
        `UPDATE calls SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id]
    );
    if (!res.rows.length) return null;
    return getCallById(id);
};

// ============================================================
// ПРИВЛЕКАЕМАЯ ТЕХНИКА (заменяем весь набор)
// ============================================================
const setCallUnits = async (callId, unitIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM call_units WHERE call_id = $1', [callId]);
        for (const unitId of unitIds) {
            await client.query(
                `INSERT INTO call_units (call_id, unit_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [callId, unitId]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ============================================================
// ХОД СОБЫТИЙ
// ============================================================
const addCallEvent = async (callId, userId, { event_at, text }) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO call_events (id, call_id, event_at, text, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, callId, event_at, text, userId]
    );
    return res.rows[0];
};

const deleteCallEvent = async (callId, eventId) => {
    const res = await pool.query(
        `DELETE FROM call_events WHERE id = $1 AND call_id = $2 RETURNING id`,
        [eventId, callId]
    );
    return res.rows.length > 0;
};

module.exports = {
    CALL_TYPES,
    CALL_RANKS,
    CALL_STATUSES,
    getUserDepartmentIds,
    getCalls,
    getCallById,
    getCallUnits,
    getCallEvents,
    createCall,
    updateCall,
    setCallStatus,
    setCallUnits,
    addCallEvent,
    deleteCallEvent,
};