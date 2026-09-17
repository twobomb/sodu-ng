const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// КАТЕГОРИИ ПОЖАРОВ (трёхуровневое дерево)
// ============================================================

const getAll = async () => {
    const res = await pool.query(
        `SELECT id, parent_id, code, name, sort_order
         FROM fire_categories
         ORDER BY code ASC`
    );
    return res.rows;
};

const getById = async (id) => {
    const res = await pool.query(
        `SELECT id, parent_id, code, name, sort_order
         FROM fire_categories WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// Количество прямых детей (для страницы справочника)
const childCount = async (id) => {
    const res = await pool.query(
        `SELECT COUNT(*)::int AS n FROM fire_categories WHERE parent_id = $1`,
        [id]
    );
    return res.rows[0].n;
};

const create = async ({ name, parent_id = null, code = '' }) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO fire_categories (id, parent_id, code, name, sort_order)
         VALUES ($1, $2, $3, $4, 0)
         RETURNING *`,
        [id, parent_id, code, name.trim()]
    );
    return res.rows[0];
};

const update = async (id, data) => {
    const fields = [];
    const values = [];
    let i = 1;

    if (data.name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(data.name.trim());
    }
    if (data.code !== undefined) {
        fields.push(`code = $${i++}`);
        values.push(data.code === '' ? null : data.code);
    }
    if (data.parent_id !== undefined) {
        // Нельзя сделать категорию своим потомком
        if (data.parent_id === id) return { error: 'Nested_self' };
        fields.push(`parent_id = $${i++}`);
        values.push(data.parent_id || null);
    }

    if (!fields.length) return getById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const res = await pool.query(
        `UPDATE fire_categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
    );
    if (!res.rows.length) return null;
    return res.rows[0];
};

const remove = async (id) => {
    const children = await childCount(id);
    if (children > 0) {
        return { ok: false, reason: 'has_children', count: children };
    }
    const used = await pool.query(
        `SELECT COUNT(*)::int AS n FROM calls WHERE fire_category_id = $1`,
        [id]
    );
    if (used.rows[0].n > 0) {
        return { ok: false, reason: 'in_use', count: used.rows[0].n };
    }
    const res = await pool.query(
        `DELETE FROM fire_categories WHERE id = $1 RETURNING id`,
        [id]
    );
    if (!res.rows.length) return { ok: false, reason: 'not_found' };
    return { ok: true };
};

module.exports = { getAll, getById, childCount, create, update, remove };