const pool = require('../db/pool');

// ============================================================
// ПОЛУЧЕНИЕ ВСЕХ ВИДОВ ПОДРАЗДЕЛЕНИЙ
// ============================================================
const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, is_system, sort_order, created_at, updated_at
         FROM department_types
         ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const create = async ({ name }) => {
    const res = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM department_types`
    );
    const order = res.rows[0].next;

    const insert = await pool.query(
        `INSERT INTO department_types (name, is_system, sort_order)
         VALUES ($1, false, $2) RETURNING *`,
        [name.trim(), order]
    );
    return insert.rows[0];
};

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
const update = async (id, { name }) => {
    const res = await pool.query(
        `UPDATE department_types SET name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [name.trim(), id]
    );
    return res.rows[0] || null;
};

// ============================================================
// УДАЛЕНИЕ
// Системные виды нельзя удалять.
// При удалении вида привязка к подразделениям сбрасывается (SET NULL).
// ============================================================
const remove = async (id) => {
    const existing = await pool.query(
        `SELECT * FROM department_types WHERE id = $1`,
        [id]
    );
    if (!existing.rows.length) return { ok: false, reason: 'not_found' };
    if (existing.rows[0].is_system) return { ok: false, reason: 'system' };

    await pool.query(`DELETE FROM department_types WHERE id = $1`, [id]);
    return { ok: true };
};

module.exports = { getAll, create, update, remove };