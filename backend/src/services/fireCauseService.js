const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// ПРИЧИНЫ ПОЖАРА
// ============================================================

const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, is_system, sort_order FROM fire_causes ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
};

const getById = async (id) => {
    const res = await pool.query(
        `SELECT id, name, is_system, sort_order FROM fire_causes WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

const create = async ({ name }) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO fire_causes (id, name, sort_order)
         VALUES ($1, $2, 0) RETURNING *`,
        [id, name.trim()]
    );
    return res.rows[0];
};

const update = async (id, data) => {
    const existing = await getById(id);
    if (!existing) return null;
    if (existing.is_system) return { error: 'system' };

    if (data.name === undefined) return getById(id);
    const res = await pool.query(
        `UPDATE fire_causes SET name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [data.name.trim(), id]
    );
    if (!res.rows.length) return null;
    return res.rows[0];
};

const remove = async (id) => {
    const existing = await getById(id);
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.is_system) return { ok: false, reason: 'system' };

    const used = await pool.query(
        `SELECT COUNT(*)::int AS n FROM calls WHERE fire_cause_id = $1`,
        [id]
    );
    if (used.rows[0].n > 0) {
        return { ok: false, reason: 'in_use', count: used.rows[0].n };
    }
    const res = await pool.query(
        `DELETE FROM fire_causes WHERE id = $1 RETURNING id`,
        [id]
    );
    if (!res.rows.length) return { ok: false, reason: 'not_found' };
    return { ok: true };
};

module.exports = { getAll, getById, create, update, remove };