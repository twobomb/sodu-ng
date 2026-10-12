const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// ЛИЧНЫЙ СОСТАВ (модуль «л/с»)
// Человек обязательно привязан к подразделению и может быть
// привязан к одной единице техники того же подразделения.
// ============================================================

const SELECT_BASE = `
  p.id, p.department_id, p.full_name, p.position, p.rank_name, p.phone, p.note,
  p.unit_id, p.sort_order, p.created_at, p.updated_at,
  d.name AS department_name,
  u.name AS unit_name, u.plate_number AS unit_plate_number,
  t.short_name AS unit_type_short_name
`;

const FROM_BASE = `
  FROM personnel p
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN units u ON p.unit_id = u.id
  LEFT JOIN unit_types t ON u.type_id = t.id
`;

// Ошибка с HTTP-статусом (контроллер её отдаёт клиенту)
const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

// Техника должна существовать и принадлежать указанному подразделению
const assertUnitInDepartment = async (unitId, departmentId) => {
    const res = await pool.query(
        'SELECT department_id FROM units WHERE id = $1',
        [unitId]
    );
    if (!res.rows.length) throw httpError(400, 'Техника не найдена');
    if (res.rows[0].department_id !== departmentId) {
        throw httpError(400, 'Техника должна быть из того же подразделения');
    }
};

// Список личного состава с учётом прав доступа
const getAllPersonnel = async (canViewAll, departmentIds = []) => {
    let where = '';
    const params = [];
    if (!canViewAll) {
        if (departmentIds.length === 0) return [];
        where = `WHERE p.department_id = ANY($1)`;
        params.push(departmentIds);
    }
    const res = await pool.query(
        `SELECT ${SELECT_BASE} ${FROM_BASE} ${where}
         ORDER BY p.sort_order ASC, p.created_at ASC`,
        params
    );
    return res.rows;
};

const getPersonnelById = async (id) => {
    const res = await pool.query(
        `SELECT ${SELECT_BASE} ${FROM_BASE} WHERE p.id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// Список людей, привязанных к конкретной технике
const getUnitPersonnel = async (unitId) => {
    const res = await pool.query(
        `SELECT ${SELECT_BASE} ${FROM_BASE} WHERE p.unit_id = $1
         ORDER BY p.sort_order ASC, p.full_name ASC`,
        [unitId]
    );
    return res.rows;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const createPersonnel = async (data) => {
    const { department_id, unit_id } = data;
    if (unit_id) await assertUnitInDepartment(unit_id, department_id);

    const id = uuidv4();
    const sortRes = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM personnel WHERE department_id = $1',
        [department_id]
    );

    await pool.query(
        `INSERT INTO personnel
            (id, department_id, full_name, position, rank_name, phone, note, unit_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            id,
            department_id,
            data.full_name,
            data.position || null,
            data.rank_name || null,
            data.phone || null,
            data.note || null,
            unit_id || null,
            sortRes.rows[0].next,
        ]
    );
    return getPersonnelById(id);
};

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
const updatePersonnel = async (id, data) => {
    const existing = await getPersonnelById(id);
    if (!existing) return null;

    const nextDepartment =
        data.department_id !== undefined ? data.department_id : existing.department_id;

    // Итоговая техника: явно переданная либо текущая
    let nextUnit;
    if (data.unit_id !== undefined) {
        nextUnit = data.unit_id || null;
    } else if (data.department_id !== undefined && data.department_id !== existing.department_id) {
        // Сменилось подразделение, техника не указана — оставляем только если
        // она из нового подразделения, иначе отвязываем.
        nextUnit = existing.unit_id;
        if (nextUnit) {
            const u = await pool.query('SELECT department_id FROM units WHERE id = $1', [nextUnit]);
            const unitDept = u.rows[0]?.department_id || null;
            if (unitDept !== nextDepartment) nextUnit = null;
        }
    } else {
        nextUnit = existing.unit_id;
    }

    if (nextUnit) await assertUnitInDepartment(nextUnit, nextDepartment);

    await pool.query(
        `UPDATE personnel SET
            department_id = $1,
            full_name = $2,
            position = $3,
            rank_name = $4,
            phone = $5,
            note = $6,
            unit_id = $7,
            updated_at = NOW()
         WHERE id = $8`,
        [
            nextDepartment,
            data.full_name !== undefined ? data.full_name : existing.full_name,
            data.position !== undefined ? (data.position || null) : existing.position,
            data.rank_name !== undefined ? (data.rank_name || null) : existing.rank_name,
            data.phone !== undefined ? (data.phone || null) : existing.phone,
            data.note !== undefined ? (data.note || null) : existing.note,
            nextUnit,
            id,
        ]
    );
    return getPersonnelById(id);
};

// ============================================================
// УДАЛЕНИЕ
// ============================================================
const deletePersonnel = async (id) => {
    const res = await pool.query('DELETE FROM personnel WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
};

// ============================================================
// ПОРЯДОК ВНУТРИ ПОДРАЗДЕЛЕНИЯ (перетаскивание)
// ============================================================
const reorderPersonnel = async (ids) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < ids.length; i++) {
            await client.query(
                'UPDATE personnel SET sort_order = $1, updated_at = NOW() WHERE id = $2',
                [i, ids[i]]
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
// ПРИВЯЗКА ЛЮДЕЙ К ТЕХНИКЕ (страница «Техника»)
// personnelIds — итоговый список привязанных к этой технике людей.
// Все они должны быть из подразделения техники; остальные отвязываются.
// ============================================================
const setUnitPersonnel = async (unitId, personnelIds) => {
    const unique = [...new Set(personnelIds || [])];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const unitRes = await client.query(
            'SELECT department_id FROM units WHERE id = $1',
            [unitId]
        );
        if (!unitRes.rows.length) throw httpError(404, 'Техника не найдена');
        const deptId = unitRes.rows[0].department_id;

        if (unique.length) {
            const rows = await client.query(
                'SELECT id, department_id FROM personnel WHERE id = ANY($1::uuid[])',
                [unique]
            );
            const byId = new Map(rows.rows.map((r) => [r.id, r.department_id]));
            for (const pid of unique) {
                const pd = byId.get(pid);
                if (!pd) throw httpError(404, 'Человек не найден');
                if (pd !== deptId) {
                    throw httpError(400, 'Человек должен быть из того же подразделения, что и техника');
                }
            }
        }

        // Отвязываем тех, кто сейчас на этой технике, но не попал в список
        await client.query(
            `UPDATE personnel SET unit_id = NULL, updated_at = NOW()
             WHERE unit_id = $1 AND NOT (id = ANY($2::uuid[]))`,
            [unitId, unique]
        );
        // Привязываем выбранных
        if (unique.length) {
            await client.query(
                'UPDATE personnel SET unit_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])',
                [unitId, unique]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return getUnitPersonnel(unitId);
};

module.exports = {
    getAllPersonnel,
    getPersonnelById,
    getUnitPersonnel,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    reorderPersonnel,
    setUnitPersonnel,
};


