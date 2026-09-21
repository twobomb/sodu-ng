const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, sort_order, created_at, updated_at
         FROM municipalities
         ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
};

const create = async ({ name }) => {
    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO municipalities (id, name)
         VALUES ($1, $2) RETURNING *`,
        [id, name]
    );
    return res.rows[0];
};

const reorder = async ({ municipalityIds }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < municipalityIds.length; i++) {
            await client.query(
                `UPDATE municipalities SET sort_order = $1, updated_at = NOW()
                 WHERE id = $2`,
                [i, municipalityIds[i]]
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

const remove = async (id) => {
    const res = await pool.query(
        `DELETE FROM municipalities WHERE id = $1 RETURNING id`,
        [id]
    );
    return res.rows.length > 0;
};

const update = async (id, { name }) => {
    const res = await pool.query(
        `UPDATE municipalities SET name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [name, id]
    );
    return res.rows[0] || null;
};

module.exports = { getAll, create, update, reorder, remove };
