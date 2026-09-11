const pool = require('../db/pool');

const getAllRoles = async () => {
    const result = await pool.query(`
    SELECT code, name, description, permissions, is_system, created_at, updated_at
    FROM roles
    ORDER BY is_system DESC, name ASC
  `);
    return result.rows;
};

const getRoleByCode = async (code) => {
    const result = await pool.query(
        `SELECT code, name, description, permissions, is_system, created_at, updated_at
     FROM roles WHERE code = $1`,
        [code]
    );
    return result.rows[0] || null;
};

const createRole = async ({ code, name, description, permissions }) => {
    const result = await pool.query(
        `INSERT INTO roles (code, name, description, permissions, is_system)
     VALUES ($1, $2, $3, $4::jsonb, false)
     RETURNING code, name, description, permissions, is_system, created_at, updated_at`,
        [code, name, description || null, JSON.stringify(permissions || [])]
    );
    return result.rows[0];
};

const updateRole = async (code, { name, description, permissions }) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(name);
    }
    if (description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(description);
    }
    if (permissions !== undefined) {
        fields.push(`permissions = $${idx++}::jsonb`);
        values.push(JSON.stringify(permissions));
    }
    fields.push(`updated_at = NOW()`);

    values.push(code);
    const result = await pool.query(
        `UPDATE roles SET ${fields.join(', ')} WHERE code = $${idx}
     RETURNING code, name, description, permissions, is_system, created_at, updated_at`,
        values
    );
    return result.rows[0] || null;
};

const deleteRole = async (code) => {
    // Системные роли нельзя удалять
    const role = await getRoleByCode(code);
    if (!role) return { ok: false, reason: 'not_found' };
    if (role.is_system) return { ok: false, reason: 'system' };

    // Проверяем, что роль не назначена пользователям
    const used = await pool.query(
        'SELECT 1 FROM users WHERE role = $1 LIMIT 1',
        [code]
    );
    if (used.rows.length > 0) {
        return { ok: false, reason: 'in_use' };
    }

    await pool.query('DELETE FROM roles WHERE code = $1', [code]);
    return { ok: true };
};

module.exports = {
    getAllRoles,
    getRoleByCode,
    createRole,
    updateRole,
    deleteRole,
};