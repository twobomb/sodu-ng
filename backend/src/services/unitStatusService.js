const pool = require('../db/pool');

// ============================================================
// ПОЛУЧЕНИЕ ВСЕХ СТАТУСОВ
// ============================================================
const getAll = async (departmentIds = null) => {
    const params = [];

    if (Array.isArray(departmentIds)) {
        if (departmentIds.length === 0) {
            const res = await pool.query(`
        SELECT
          s.id, s.name, s.short_name, s.color, s.color_name,
          s.sort_order, s.is_system, s.group_kind,
          s.created_at, s.updated_at,
          0 AS units_count
        FROM unit_statuses s
        ORDER BY s.sort_order ASC, s.name ASC
      `);
            return res.rows;
        }
        params.push(departmentIds);
    }

    const filterJoin = Array.isArray(departmentIds)
        ? `LEFT JOIN units u
         ON u.status_id = s.id AND u.department_id = ANY($1::uuid[])`
        : `LEFT JOIN units u ON u.status_id = s.id`;

    const res = await pool.query(
        `
    SELECT
      s.id, s.name, s.short_name, s.color, s.color_name,
      s.sort_order, s.is_system, s.group_kind,
      s.created_at, s.updated_at,
      COUNT(u.id)::int AS units_count
    FROM unit_statuses s
    ${filterJoin}
    GROUP BY s.id
    ORDER BY s.sort_order ASC, s.name ASC
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
        `SELECT * FROM unit_statuses WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const create = async ({ name, short_name, color, color_name, sort_order }) => {
    let order = sort_order;
    if (order === undefined || order === null) {
        const res = await pool.query(
            `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM unit_statuses`
        );
        order = res.rows[0].next;
    }

    const res = await pool.query(
        `INSERT INTO unit_statuses
       (name, short_name, color, color_name, sort_order, is_system)
     VALUES ($1, $2, $3, $4, $5, false)
     RETURNING *`,
        [name.trim(), short_name.trim(), color, color_name || null, order]
    );
    return res.rows[0];
};

// ============================================================
// ОБНОВЛЕНИЕ
// Системные статусы можно редактировать (цвет, название), но нельзя удалять
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
    if (data.color !== undefined) {
        fields.push(`color = $${idx++}`);
        values.push(data.color);
    }
    if (data.color_name !== undefined) {
        fields.push(`color_name = $${idx++}`);
        values.push(data.color_name);
    }
    if (data.sort_order !== undefined) {
        fields.push(`sort_order = $${idx++}`);
        values.push(data.sort_order);
    }

    if (!fields.length) return getById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await pool.query(
        `UPDATE unit_statuses SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
        values
    );
    return res.rows[0] || null;
};

// ============================================================
// УДАЛЕНИЕ
// ============================================================
const remove = async (id) => {
    const status = await getById(id);
    if (!status) return { ok: false, reason: 'not_found' };

    if (status.is_system) {
        return { ok: false, reason: 'system' };
    }

    const used = await pool.query(
        `SELECT COUNT(*)::int AS n FROM units WHERE status_id = $1`,
        [id]
    );
    if (used.rows[0].n > 0) {
        return { ok: false, reason: 'in_use', count: used.rows[0].n };
    }

    await pool.query(`DELETE FROM unit_statuses WHERE id = $1`, [id]);
    return { ok: true };
};

module.exports = { getAll, getById, create, update, remove };