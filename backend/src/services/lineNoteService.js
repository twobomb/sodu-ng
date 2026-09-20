const pool = require('../db/pool');

// ============================================================
// СПИСОК ЗАПИСОК ПОДРАЗДЕЛЕНИЯ (только даты и статусы — для календаря)
// ============================================================
const listByDepartment = async (departmentId) => {
    const res = await pool.query(
        `SELECT id, note_date::text AS note_date, status
         FROM line_notes
         WHERE department_id = $1
         ORDER BY note_date ASC`,
        [departmentId]
    );
    return res.rows;
};

// ============================================================
// ПОЛУЧЕНИЕ ПО ПОДРАЗДЕЛЕНИЮ И ДАТЕ
// ============================================================
const getByDepartmentAndDate = async (departmentId, noteDate) => {
    const res = await pool.query(
        `SELECT id, department_id, note_date::text AS note_date, status, data,
                created_by, created_at, updated_at
         FROM line_notes
         WHERE department_id = $1 AND note_date = $2`,
        [departmentId, noteDate]
    );
    return res.rows[0] || null;
};

// ============================================================
// ПОЛУЧЕНИЕ ПО ID
// ============================================================
const getById = async (id) => {
    const res = await pool.query(
        `SELECT * FROM line_notes WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const create = async ({
    department_id,
    note_date,
    status,
    data,
    created_by,
}) => {
    const res = await pool.query(
        `INSERT INTO line_notes (department_id, note_date, status, data, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
            department_id,
            note_date,
            status,
            JSON.stringify(data || {}),
            created_by || null,
        ]
    );
    return res.rows[0];
};

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
const update = async (id, { status, data }) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(status);
    }
    if (data !== undefined) {
        fields.push(`data = $${idx++}`);
        values.push(JSON.stringify(data || {}));
    }

    if (fields.length) {
        fields.push(`updated_at = NOW()`);
    }

    if (!fields.length) {
        return getById(id);
    }

    values.push(id);
    const res = await pool.query(
        `UPDATE line_notes SET ${fields.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return res.rows[0] || null;
};

// ============================================================
// СТАТУСЫ ЗАПИСОК НА ДАТУ ПО СПИСКУ ПОДРАЗДЕЛЕНИЙ (для бейджей)
// ============================================================
const statusByDate = async (departmentIds, date) => {
    const res = await pool.query(
        `SELECT department_id, status
         FROM line_notes
         WHERE note_date = $1 AND department_id = ANY($2::uuid[])`,
        [date, departmentIds]
    );
    const byDept = res.rows.reduce((m, r) => {
        m[r.department_id] = r.status;
        return m;
    }, {});
    return departmentIds.map((id) => ({
        department_id: id,
        status: byDept[id] || null,
    }));
};

// ============================================================
// КОПИРОВАНИЕ ЗАПИСКИ НА ДРУГУЮ ДАТУ
// - источник должен существовать
// - перезаписываем только черновик или создаём новый
//   (на утверждённую записку копировать нельзя)
// ============================================================
const copy = async ({ department_id, from_date, to_date, created_by }) => {
    const from = await getByDepartmentAndDate(department_id, from_date);
    if (!from) return { ok: false, error: 'source_not_found' };

    const to = await getByDepartmentAndDate(department_id, to_date);
    if (to && to.status === 'approved') {
        return { ok: false, error: 'target_approved' };
    }

    const data = from.data || {};
    let note;
    if (to) {
        note = await update(to.id, { status: 'draft', data });
    } else {
        note = await create({
            department_id,
            note_date: to_date,
            status: 'draft',
            data,
            created_by,
        });
    }
    return { ok: true, note };
};

module.exports = {
    listByDepartment,
    getByDepartmentAndDate,
    getById,
    create,
    update,
    copy,
    statusByDate,
};