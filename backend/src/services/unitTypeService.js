const pool = require('../db/pool');
const logger = require('../utils/logger');

// ============================================================
// ПОЛУЧЕНИЕ ВСЕХ ТИПОВ
// ============================================================
const getAll = async (departmentIds = null) => {
    // Если departmentIds === null — считаем всё (can_view_all)
    // Если массив — считаем только по этим подразделениям
    const params = [];
    let filterJoin = '';
    let filterWhere = '';

    if (Array.isArray(departmentIds)) {
        if (departmentIds.length === 0) {
            // Нет доступных подразделений — все счётчики по нулям
            const res = await pool.query(`
        SELECT
          t.id, t.name, t.short_name, t.sort_order,
          t.created_at, t.updated_at,
          0 AS units_count
        FROM unit_types t
        ORDER BY t.sort_order ASC, t.name ASC
      `);
            return res.rows;
        }

        params.push(departmentIds);
        filterJoin = `
      LEFT JOIN units u
        ON u.type_id = t.id AND u.department_id = ANY($1::uuid[])
    `;
    } else {
        filterJoin = `LEFT JOIN units u ON u.type_id = t.id`;
    }

    const res = await pool.query(
        `
            SELECT
                t.id, t.name, t.short_name, t.sort_order,
                t.created_at, t.updated_at,
                COUNT(u.id)::int AS units_count
            FROM unit_types t
                ${filterJoin}
            GROUP BY t.id
            ORDER BY t.sort_order ASC, t.name ASC
        `,
        params
    );
    return res.rows;
};
// ============================================================
// ПОЛУЧЕНИЕ ОДНОГО
// ============================================================
const getById = async (id) => {
    const res = await pool.query(
        `SELECT * FROM unit_types WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const create = async ({ name, short_name, sort_order }) => {
    // Если sort_order не задан — берём максимальный + 10
    let order = sort_order;
    if (order === undefined || order === null) {
        const res = await pool.query(
            `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM unit_types`
        );
        order = res.rows[0].next;
    }

    const res = await pool.query(
        `INSERT INTO unit_types (name, short_name, sort_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [name.trim(), short_name.trim(), order]
    );
    return res.rows[0];
};

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
const update = async (id, data) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(data.name.trim());
    }
    if (data.short_name !== undefined) {
        fields.push(`short_name = $${idx++}`);
        values.push(data.short_name.trim());
    }
    if (data.sort_order !== undefined) {
        fields.push(`sort_order = $${idx++}`);
        values.push(data.sort_order);
    }

    if (!fields.length) {
        return getById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await pool.query(
        `UPDATE unit_types SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
        values
    );
    return res.rows[0] || null;
};

// ============================================================
// УДАЛЕНИЕ
// Проверяем, что тип не используется техникой
// ============================================================
const remove = async (id) => {
    const used = await pool.query(
        `SELECT COUNT(*)::int AS n FROM units WHERE type_id = $1`,
        [id]
    );
    if (used.rows[0].n > 0) {
        return { ok: false, reason: 'in_use', count: used.rows[0].n };
    }

    const res = await pool.query(
        `DELETE FROM unit_types WHERE id = $1 RETURNING id`,
        [id]
    );
    if (!res.rows.length) return { ok: false, reason: 'not_found' };
    return { ok: true };
};

module.exports = { getAll, getById, create, update, remove };