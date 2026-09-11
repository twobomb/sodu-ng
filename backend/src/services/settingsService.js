const pool = require('../db/pool');

const getAll = async () => {
    const result = await pool.query('SELECT key, value FROM system_settings');
    return result.rows.reduce((acc, r) => {
        acc[r.key] = r.value;
        return acc;
    }, {});
};

const get = async (key) => {
    const result = await pool.query(
        'SELECT value FROM system_settings WHERE key = $1',
        [key]
    );
    return result.rows[0]?.value;
};

const set = async (key, value, updatedBy) => {
    const result = await pool.query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
     RETURNING key, value`,
        [key, JSON.stringify(value), updatedBy]
    );
    return result.rows[0];
};

module.exports = { getAll, get, set };