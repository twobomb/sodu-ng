const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const getAll = async () => {
    const res = await pool.query(
        `SELECT id, name, created_at, updated_at
         FROM municipalities
         ORDER BY name`
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

const remove = async (id) => {
    const res = await pool.query(
        `DELETE FROM municipalities WHERE id = $1 RETURNING id`,
        [id]
    );
    return res.rows.length > 0;
};

module.exports = { getAll, create, remove };
