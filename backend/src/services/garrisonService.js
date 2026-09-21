const pool = require('../db/pool');

// ============================================================
// ПОЛУЧЕНИЕ ВСЕХ ГАРНИЗОНОВ
// Порядок определяется sort_order (меняется перетаскиванием).
// ============================================================
const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, sort_order, created_at, updated_at
         FROM garrisons
         ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
const create = async ({ name }) => {
    const res = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM garrisons`
    );
    const order = res.rows[0].next;

    const insert = await pool.query(
        `INSERT INTO garrisons (name, sort_order) VALUES ($1, $2) RETURNING *`,
        [name.trim(), order]
    );
    return insert.rows[0];
};

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
const update = async (id, { name }) => {
    const res = await pool.query(
        `UPDATE garrisons SET name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [name.trim(), id]
    );
    return res.rows[0] || null;
};

// ============================================================
// ПЕРЕСТАНОВКА (перетаскивание на странице)
// ============================================================
const reorder = async ({ garrisonIds }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < garrisonIds.length; i++) {
            await client.query(
                `UPDATE garrisons SET sort_order = $1, updated_at = NOW()
                 WHERE id = $2`,
                [i, garrisonIds[i]]
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
// При удалении гарнизона привязка к подразделениям сбрасывается (SET NULL).
// ============================================================
const remove = async (id) => {
    const existing = await pool.query(`SELECT * FROM garrisons WHERE id = $1`, [id]);
    if (!existing.rows.length) return { ok: false, reason: 'not_found' };

    await pool.query(`DELETE FROM garrisons WHERE id = $1`, [id]);
    return { ok: true };
};

module.exports = { getAll, create, update, remove, reorder };