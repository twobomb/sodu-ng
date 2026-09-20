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
          t.id, t.name, t.short_name, t.category, t.sort_order, t.show_in_line_note,
          t.created_at, t.updated_at,
          0 AS units_count
        FROM unit_types t
        ORDER BY
          CASE t.category
            WHEN 'Основная техника' THEN 0
            WHEN 'Специальная техника' THEN 1
            WHEN 'Вспомогательная техника' THEN 2
            WHEN 'Пожарный поезд' THEN 3
            WHEN 'Приспособленная и другая' THEN 4
            ELSE 5
          END ASC,
          t.sort_order ASC, t.name ASC
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
                t.id, t.name, t.short_name, t.category, t.sort_order, t.show_in_line_note,
                t.created_at, t.updated_at,
                COUNT(u.id)::int AS units_count
            FROM unit_types t
                ${filterJoin}
            GROUP BY t.id
            ORDER BY
                CASE t.category
                    WHEN 'Основная техника' THEN 0
                    WHEN 'Специальная техника' THEN 1
                    WHEN 'Вспомогательная техника' THEN 2
                    WHEN 'Пожарный поезд' THEN 3
                    WHEN 'Приспособленная и другая' THEN 4
                    ELSE 5
                END ASC,
                t.sort_order ASC, t.name ASC
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
const create = async ({ name, short_name, category = null, sort_order, show_in_line_note = true }) => {
    // Если sort_order не задан — берём максимальный + 10
    let order = sort_order;
    if (order === undefined || order === null) {
        const res = await pool.query(
            `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM unit_types`
        );
        order = res.rows[0].next;
    }

    const res = await pool.query(
        `INSERT INTO unit_types (name, short_name, category, sort_order, show_in_line_note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [name.trim(), short_name.trim(), category || null, order, Boolean(show_in_line_note)]
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
    if (data.category !== undefined) {
        fields.push(`category = $${idx++}`);
        values.push(data.category === '' ? null : data.category);
    }
    if (data.show_in_line_note !== undefined) {
        fields.push(`show_in_line_note = $${idx++}`);
        values.push(Boolean(data.show_in_line_note));
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
// СОРТИРОВКА ВНУТРИ КАТЕГОРИИ
// ============================================================
const reorder = async ({ category, unitTypeIds }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < unitTypeIds.length; i++) {
            await client.query(
                `UPDATE unit_types SET sort_order = $1, updated_at = NOW()
                 WHERE id = $2 AND category = $3`,
                [i, unitTypeIds[i], category]
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

module.exports = { getAll, getById, create, update, reorder, remove };