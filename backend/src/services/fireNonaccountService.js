const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// ПРИЧИНЫ, ПО КОТОРЫМ ПОЖАР НЕ ПОДЛЕЖИТ УЧЁТУ
// ============================================================

const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, sort_order FROM fire_nonaccount_reasons ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
};

const getById = async (id) => {
    const res = await pool.query(
        `SELECT id, name, sort_order FROM fire_nonaccount_reasons WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

const create = async ({ name }) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO fire_nonaccount_reasons (id, name, sort_order)
         VALUES ($1, $2, 0) RETURNING *`,
        [id, name.trim()]
    );
    return res.rows[0];
};

const update = async (id, data) => {
    if (data.name === undefined) return getById(id);
    const res = await pool.query(
        `UPDATE fire_nonaccount_reasons SET name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [data.name.trim(), id]
    );
    if (!res.rows.length) return null;
    return res.rows[0];
};

const remove = async (id) => {
    const used = await pool.query(
        `SELECT COUNT(*)::int AS n FROM calls WHERE not_accounted_reason_id = $1`,
        [id]
    );
    if (used.rows[0].n > 0) {
        return { ok: false, reason: 'in_use', count: used.rows[0].n };
    }
    const res = await pool.query(
        `DELETE FROM fire_nonaccount_reasons WHERE id = $1 RETURNING id`,
        [id]
    );
    if (!res.rows.length) return { ok: false, reason: 'not_found' };
    return { ok: true };
};

module.exports = { getAll, getById, create, update, remove };