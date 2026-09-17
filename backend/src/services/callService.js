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
  c.incident_at, c.message_received_at,
  c.department_id, c.municipality_id, c.address,
  c.dispatch_at, c.arrival_at,
  c.localization_at, c.open_fire_eliminated_at, c.fire_eliminated_at,
  c.description, c.created_by, c.created_at, c.updated_at,
  c.fire_area, c.area_type,
  c.fire_category_id, c.fire_cause_id, c.fire_cause_other,
  c.not_accounted_fire, c.not_accounted_reason_id,
  c.victims_dead_total, c.victims_dead_children, c.victims_dead_data,
  c.victims_injured_total, c.victims_injured_children, c.victims_injured_data,
  c.victims_rescued_total, c.victims_rescued_children, c.victims_rescued_data,
  c.victims_evacuated_total, c.victims_evacuated_children,
  u.username AS creator_username,
  d.name AS department_name,
  m.name AS municipality_name,
  fc.name AS fire_category_name, fc.code AS fire_category_code,
  fca.name AS fire_cause_name,
  fna.name AS not_accounted_reason_name
`;

const FROM_CALL_BASE = `
  FROM calls c
  LEFT JOIN users u ON c.created_by = u.id
  LEFT JOIN departments d ON c.department_id = d.id
  LEFT JOIN municipalities m ON c.municipality_id = m.id
  LEFT JOIN fire_categories fc ON c.fire_category_id = fc.id
  LEFT JOIN fire_causes fca ON c.fire_cause_id = fca.id
  LEFT JOIN fire_nonaccount_reasons fna ON c.not_accounted_reason_id = fna.id
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
// ОКРУГА: доступные пользователю (по подразделениям пользователя)
// Смотрим подразделения, к которым есть доступ, берём их округа,
// составляем список уникальных округов.
// ============================================================
const getAccessibleMunicipalities = async (userId, canViewAll) => {
    if (canViewAll) {
        const res = await pool.query(
            `SELECT m.id, m.name
             FROM municipalities m
             ORDER BY m.name`
        );
        return res.rows;
    }
    const deps = await getUserDepartmentIds(userId);
    if (!deps.length) return [];
    const res = await pool.query(
        `SELECT DISTINCT m.id, m.name
         FROM municipalities m
         JOIN departments d ON d.municipality_id = m.id
         WHERE d.id = ANY($1)
         ORDER BY m.name`,
        [deps]
    );
    return res.rows;
};

// ============================================================
// СПИСОК
// «Все статусы» показывает все вызовы, включая ошибочные.
// Фильтр по конкретному статусу — только этот статус.
// ============================================================
const getCalls = async (filters = {}) => {
    const conds = [];
    const params = [];
    let i = 1;

    const status = filters.status || 'all';
    if (status && status !== 'all') {
        conds.push(`c.status = $${i++}`);
        params.push(status);
    }

    if (filters.type && filters.type !== 'all') {
        conds.push(`c.type = $${i++}`);
        params.push(filters.type);
    }
    if (filters.search) {
        conds.push(
            `(c.address ILIKE $${i} OR m.name ILIKE $${i} OR c.description ILIKE $${i})`
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

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const pageSizes = [10, 25, 50, 100];
    const pageSize = pageSizes.includes(Number(filters.pageSize))
        ? Number(filters.pageSize)
        : 25;
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const totalRes = await pool.query(
        `SELECT count(*)::int AS total ${FROM_CALL_BASE} ${where}`,
        params
    );
    const total = totalRes.rows[0].total;

    const dataRes = await pool.query(
        `SELECT ${SELECT_CALL_BASE},
                    (SELECT count(*)::int FROM call_units cu WHERE cu.call_id = c.id)  AS units_count,
                    (SELECT count(*)::int FROM call_events ce WHERE ce.call_id = c.id) AS events_count
         ${FROM_CALL_BASE} ${where}
         ORDER BY c.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, pageSize, offset]
    );

    return { items: dataRes.rows, total, page, pageSize };
};

const getCallById = async (id) => {
    const res = await pool.query(
        `SELECT ${SELECT_CALL_BASE} ${FROM_CALL_BASE} WHERE c.id = $1`,
        [id]
    );
    if (!res.rows.length) return null;

    const call = res.rows[0];
    call.units = await getCallUnits(id);
    call.events = await getCallEvents(id);
    return call;
};

// ============================================================
// СОЗДАНИЕ — новый вызов: тип «Пожар», округ по умолчанию
// ============================================================
const createCall = async (userId, canViewAll) => {
    const id = uuidv4();
    let departmentId = null;
    let municipalityId = null;

    if (!canViewAll) {
        const deps = await getUserDepartmentIds(userId);
        if (deps.length === 1) {
            departmentId = deps[0];
            const mres = await pool.query(
                `SELECT municipality_id FROM departments WHERE id = $1`,
                [deps[0]]
            );
            if (mres.rows.length) municipalityId = mres.rows[0].municipality_id;
        }
    }

    await pool.query(
        `INSERT INTO calls (id, status, type, department_id, municipality_id, created_by)
         VALUES ($1, 'processing', 'Пожар', $2, $3, $4)`,
        [id, departmentId, municipalityId, userId]
    );

    return getCallById(id);
};

// ============================================================
// ОБНОВЛЕНИЕ ПОЛЕЙ
// ============================================================
const UPDATE_COLUMNS = [
    'type',
    'rank',
    'incident_at',
    'message_received_at',
    'department_id',
    'municipality_id',
    'address',
    'dispatch_at',
    'arrival_at',
    'localization_at',
    'open_fire_eliminated_at',
    'fire_eliminated_at',
    'description',
    'fire_area',
    'area_type',
    'fire_category_id',
    'fire_cause_id',
    'fire_cause_other',
    'not_accounted_fire',
    'not_accounted_reason_id',
    'victims_dead_total',
    'victims_dead_children',
    'victims_dead_data',
    'victims_injured_total',
    'victims_injured_children',
    'victims_injured_data',
    'victims_rescued_total',
    'victims_rescued_children',
    'victims_rescued_data',
    'victims_evacuated_total',
    'victims_evacuated_children',
];

const updateCall = async (id, data) => {
    const fields = [];
    const params = [];
    let i = 1;

    for (const col of UPDATE_COLUMNS) {
        if (data[col] !== undefined) {
            fields.push(`${col} = $${i++}`);
            let val = data[col] === '' ? null : data[col];
            // jsonb-колонки данных пострадавших сериализуем в JSON строку
            if (col.endsWith('_data')) {
                val = val == null ? null : JSON.stringify(val);
            }
            params.push(val);
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
        `UPDATE calls SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
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
    getAccessibleMunicipalities,
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


