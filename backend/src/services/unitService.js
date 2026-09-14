const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ============================================================
// Общая часть SELECT — используется в нескольких запросах
// ============================================================
const SELECT_UNIT_BASE = `
  u.id, u.name, u.plate_number, u.department_id,
  u.type_id, u.status_id, u.squad_number, u.show_in_grid,
  u.created_at, u.updated_at,
  t.name       AS type_name,
  t.short_name AS type_short_name,
  s.name       AS status_name,
  s.short_name AS status_short_name,
  s.color      AS status_color,
  s.color_name AS status_color_name,
  d.name       AS department_name
`;

const FROM_UNIT_BASE = `
  FROM units u
  LEFT JOIN unit_types t ON u.type_id = t.id
  LEFT JOIN unit_statuses s ON u.status_id = s.id
  LEFT JOIN departments d ON u.department_id = d.id
`;

// ============================================================
// ПОЛУЧЕНИЕ ТЕХНИКИ С УЧЁТОМ ПРАВ
// ============================================================
const getAllUnits = async (userId, canViewAll, departmentIds = []) => {
    let where = '';
    const params = [];

    if (!canViewAll) {
        if (departmentIds.length === 0) return [];
        where = `WHERE u.department_id = ANY($1)`;
        params.push(departmentIds);
    }

    const res = await pool.query(
        `SELECT ${SELECT_UNIT_BASE} ${FROM_UNIT_BASE} ${where}
     ORDER BY u.created_at DESC`,
        params
    );
    return res.rows;
};

const getUnitById = async (id) => {
    const res = await pool.query(
        `SELECT ${SELECT_UNIT_BASE} ${FROM_UNIT_BASE} WHERE u.id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// ============================================================
// СОЗДАНИЕ ТЕХНИКИ
// Сразу пишем запись в историю статусов (если статус задан)
// ============================================================
const createUnit = async (data, actorId) => {
    const {
        name,
        plate_number,
        status_id,
        type_id,
        department_id,
        squad_number,
        show_in_grid,
    } = data;

    const id = uuidv4();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const res = await client.query(
            `INSERT INTO units
        (id, name, plate_number, status_id, type_id, department_id, squad_number, show_in_grid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
            [
                id,
                name,
                plate_number || null,
                status_id || null,
                type_id || null,
                department_id,
                squad_number ?? null,
                show_in_grid !== false,
            ]
        );

        // Запись начального статуса в историю
        if (status_id) {
            const statusRes = await client.query(
                `SELECT name, short_name, color FROM unit_statuses WHERE id = $1`,
                [status_id]
            );
            if (statusRes.rows.length) {
                const s = statusRes.rows[0];
                await client.query(
                    `INSERT INTO unit_status_history
             (unit_id, status_id, status_name, status_short_name, status_color, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [id, status_id, s.name, s.short_name, s.color, actorId || null]
                );
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return getUnitById(id);
};

// ============================================================
// ОБНОВЛЕНИЕ ТЕХНИКИ
// Статус меняется ОТДЕЛЬНО через changeStatus()
// ============================================================
const updateUnit = async (id, data) => {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = [
        'name',
        'plate_number',
        'type_id',
        'department_id',
        'squad_number',
        'show_in_grid',
    ];

    for (const key of allowed) {
        if (data[key] !== undefined) {
            fields.push(`${key} = $${idx++}`);
            values.push(data[key]);
        }
    }

    if (!fields.length) return getUnitById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await pool.query(
        `UPDATE units SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id`,
        values
    );

    if (!res.rows.length) return null;
    return getUnitById(id);
};

// ============================================================
// СМЕНА СТАТУСА
// Пишет запись в историю. Если статус тот же — не пишет.
// ============================================================
const changeStatus = async (unitId, statusId, actorId, comment = null) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Текущий статус
        const currentRes = await client.query(
            `SELECT status_id FROM units WHERE id = $1`,
            [unitId]
        );
        if (!currentRes.rows.length) {
            await client.query('ROLLBACK');
            return { ok: false, reason: 'not_found' };
        }

        const currentStatusId = currentRes.rows[0].status_id;

        // Если статус не меняется — не пишем в историю
        if (currentStatusId === statusId) {
            await client.query('COMMIT');
            return { ok: true, unit: await getUnitById(unitId), noChange: true };
        }

        // Проверяем, что новый статус существует
        const statusRes = await client.query(
            `SELECT id, name, short_name, color FROM unit_statuses WHERE id = $1`,
            [statusId]
        );
        if (!statusRes.rows.length) {
            await client.query('ROLLBACK');
            return { ok: false, reason: 'status_not_found' };
        }
        const s = statusRes.rows[0];

        // Обновляем технику
        await client.query(
            `UPDATE units SET status_id = $1, updated_at = NOW() WHERE id = $2`,
            [statusId, unitId]
        );

        // Пишем в историю
        await client.query(
            `INSERT INTO unit_status_history
         (unit_id, status_id, status_name, status_short_name, status_color, changed_by, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [unitId, statusId, s.name, s.short_name, s.color, actorId || null, comment]
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    const unit = await getUnitById(unitId);
    return { ok: true, unit };
};

// ============================================================
// УДАЛЕНИЕ
// ============================================================
const deleteUnit = async (id) => {
    const res = await pool.query(
        `DELETE FROM units WHERE id = $1 RETURNING id`,
        [id]
    );
    return res.rows.length > 0;
};
// ============================================================
// ИСТОРИЯ КОНКРЕТНОЙ ТЕХНИКИ — курсорная пагинация
// ============================================================
const getUnitHistory = async (unitId, { limit = 50, before = null } = {}) => {
    const params = [unitId];
    let cursorWhere = '';

    if (before && before.changed_at && before.id) {
        params.push(before.changed_at, before.id);
        cursorWhere = `AND (h.changed_at, h.id) < ($2::timestamptz, $3::uuid)`;
    }

    // +1 чтобы узнать, есть ли ещё страницы
    params.push(limit + 1);

    const res = await pool.query(
        `
            SELECT
                h.id, h.unit_id, h.status_id,
                h.status_name, h.status_short_name, h.status_color,
                h.comment, h.changed_at,
                u.username         AS changed_by_username,
                p.display_name     AS changed_by_display_name
            FROM unit_status_history h
                     LEFT JOIN users u ON u.id = h.changed_by
                     LEFT JOIN user_chat_profiles p ON p.user_id = h.changed_by
            WHERE h.unit_id = $1
                ${cursorWhere}
            ORDER BY h.changed_at DESC, h.id DESC
                LIMIT $${params.length}
        `,
        params
    );

    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    const lastRow = rows[rows.length - 1];
    const nextCursor =
        hasMore && lastRow
            ? { changed_at: lastRow.changed_at, id: lastRow.id }
            : null;

    return { rows, hasMore, nextCursor };
};

// ============================================================
// ГЛОБАЛЬНЫЙ ЛОГ (все изменения по доступным подразделениям)
// ============================================================
const getGlobalHistory = async (
    userId,
    canViewAll,
    departmentIds = [],
    { limit = 50, before = null } = {}
) => {
    const params = [];
    let where = 'WHERE 1=1';

    // Фильтр по подразделениям
    if (!canViewAll) {
        if (departmentIds.length === 0) return [];
        params.push(departmentIds);
        where += ` AND un.department_id = ANY($${params.length})`;
    }

    if (before) {
        params.push(before);
        where += ` AND h.changed_at < $${params.length}`;
    }

    params.push(limit);

    const res = await pool.query(
        `
    SELECT
      h.id, h.unit_id, h.status_id,
      h.status_name, h.status_short_name, h.status_color,
      h.comment, h.changed_at,
      un.name            AS unit_name,
      un.plate_number    AS unit_plate_number,
      un.department_id   AS department_id,
      dep.name           AS department_name,
      t.short_name       AS unit_type_short,
      u.username         AS changed_by_username,
      p.display_name     AS changed_by_display_name
    FROM unit_status_history h
    JOIN units un ON un.id = h.unit_id
    LEFT JOIN departments dep ON dep.id = un.department_id
    LEFT JOIN unit_types t ON t.id = un.type_id
    LEFT JOIN users u ON u.id = h.changed_by
    LEFT JOIN user_chat_profiles p ON p.user_id = h.changed_by
    ${where}
    ORDER BY h.changed_at DESC, h.id DESC
    LIMIT $${params.length}
    `,
        params
    );

    return res.rows;
};
// ============================================================
// СЕТКА "ВСЯ ТЕХНИКА"
// Возвращает подразделения с техникой внутри, с учётом иерархии
// sort: 'default' | 'dynamic'
// ============================================================
const getGridData = async (userId, canViewAll, departmentIds = [], sort = 'default') => {
    // 1. Какие подразделения видны пользователю
    let deptWhere = '';
    const deptParams = [];

    if (!canViewAll) {
        if (departmentIds.length === 0) return [];
        deptWhere = `WHERE d.id = ANY($1)`;
        deptParams.push(departmentIds);
    }

    // 2. Забираем подразделения с полями для сортировки
    const deptsRes = await pool.query(
        `
    SELECT
      d.id, d.name, d.parent_id, d.sort_order, d.created_at
    FROM departments d
    ${deptWhere}
    ORDER BY d.parent_id NULLS FIRST, d.sort_order ASC, d.name ASC
    `,
        deptParams
    );

    const departments = deptsRes.rows;
    if (departments.length === 0) return [];

    const deptIds = departments.map((d) => d.id);

    // 3. Забираем технику для этих подразделений
    const unitsRes = await pool.query(
        `
            SELECT
                u.id, u.name, u.plate_number,
                u.department_id, u.type_id, u.status_id,
                u.squad_number, u.updated_at,
                t.short_name AS type_short_name,
                t.name       AS type_name,
                s.name       AS status_name,
                s.short_name AS status_short_name,
                s.color      AS status_color,
                s.color_name AS status_color_name,
                d.name       AS department_name,
                (
                    SELECT MAX(changed_at)
                    FROM unit_status_history h
                    WHERE h.unit_id = u.id
                ) AS status_changed_at
            FROM units u
                     LEFT JOIN unit_types t ON u.type_id = t.id
                     LEFT JOIN unit_statuses s ON u.status_id = s.id
                     LEFT JOIN departments d ON d.id = u.department_id
            WHERE u.department_id = ANY($1::uuid[])
              AND u.show_in_grid = true
            ORDER BY u.squad_number ASC NULLS LAST, u.name ASC
        `,
        [deptIds]
    );

    // 4. Группируем технику по подразделениям
    const unitsByDept = {};
    for (const u of unitsRes.rows) {
        if (!unitsByDept[u.department_id]) unitsByDept[u.department_id] = [];
        unitsByDept[u.department_id].push(u);
    }

    // 5. Считаем "активные выезды" для каждого подразделения
    const ACTIVE_STATUSES = ['в дороге к м/в', 'на месте вызова', 'Возвращается'];
    const hasActiveCall = {};
    for (const [deptId, units] of Object.entries(unitsByDept)) {
        hasActiveCall[deptId] = units.some((u) =>
            ACTIVE_STATUSES.includes(u.status_short_name)
        );
    }
// 6. Считаем level для отображения иерархии.
// ВАЖНО: если у подразделения есть parent_id, но родитель не в выборке
// (у пользователя нет на него прав), считаем его корневым —
// иначе оно потеряется и не попадёт в сетку.

    const visibleIds = new Set(departments.map((d) => d.id));
    const childrenMap = {};
    const roots = [];

    for (const d of departments) {
        // Родитель есть и он виден пользователю → это ребёнок
        if (d.parent_id && visibleIds.has(d.parent_id)) {
            if (!childrenMap[d.parent_id]) childrenMap[d.parent_id] = [];
            childrenMap[d.parent_id].push(d);
        } else {
            // Либо корневое, либо родитель недоступен → показываем на верхнем уровне
            roots.push(d);
        }
    }

    const flat = [];
    const walk = (nodes, level) => {
        for (const node of nodes) {
            flat.push({
                department_id: node.id,
                department_name: node.name,
                parent_id: node.parent_id,
                sort_order: node.sort_order,
                level,
                has_active_call: hasActiveCall[node.id] || false,
                units: unitsByDept[node.id] || [],
            });
            const kids = childrenMap[node.id] || [];
            walk(kids, level + 1);
        }
    };
    walk(roots, 0);

    // 7. Применяем динамическую сортировку если нужно
    if (sort === 'dynamic') {
        // Стабильная сортировка: сначала с активным выездом, потом остальные.
        // Внутри групп сохраняем исходный порядок (по sort_order подразделений).
        // Чтобы сохранить иерархию (родитель не должен улетать вниз, если у ребёнка
        // есть активный выезд), применяем агрегат: узел считается "активным",
        // если активен он сам или любой его потомок в видимой части.
        const activeSubtree = {};

        const computeActiveSubtree = (nodes) => {
            for (const node of nodes) {
                const kids = childrenMap[node.id] || [];
                const childActive = computeActiveSubtree(kids);
                activeSubtree[node.id] =
                    (hasActiveCall[node.id] || false) || childActive;
            }
            // Считаем для узлов, которые в visibleIds
            return nodes.some((n) => activeSubtree[n.id]);
        };

        computeActiveSubtree(roots);

        // Пересобираем flat с учётом новой сортировки:
        // при обходе на каждом уровне сначала идут узлы с активным поддеревом.
        const flat2 = [];
        const walkSorted = (nodes, level) => {
            const sorted = [...nodes].sort((a, b) => {
                const aA = activeSubtree[a.id] ? 0 : 1;
                const bA = activeSubtree[b.id] ? 0 : 1;
                if (aA !== bA) return aA - bA;
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
            for (const node of sorted) {
                flat2.push({
                    department_id: node.id,
                    department_name: node.name,
                    parent_id: node.parent_id,
                    sort_order: node.sort_order,
                    level,
                    has_active_call: hasActiveCall[node.id] || false,
                    units: unitsByDept[node.id] || [],
                });
                const kids = childrenMap[node.id] || [];
                walkSorted(kids, level + 1);
            }
        };
        walkSorted(roots, 0);
        return flat2;
    }

    return flat;
};
module.exports = {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    changeStatus,
    deleteUnit,
    getUnitHistory,
    getGlobalHistory,
    getGridData,
};