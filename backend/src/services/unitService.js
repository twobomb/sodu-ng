const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

/**
 * Получить все единицы техники с учётом прав пользователя.
 */
const getAllUnits = async (userId, canViewAll, departmentIds = []) => {
    let query = `
    SELECT 
      u.id, u.name, u.type, u.plate_number, u.status, 
      u.department_id, u.created_at, u.updated_at,
      d.name as department_name
    FROM units u
    LEFT JOIN departments d ON u.department_id = d.id
  `;

    const params = [];
    let whereClause = '';

    if (!canViewAll) {
        if (departmentIds.length === 0) {
            return [];
        }
        whereClause = `WHERE u.department_id = ANY($1)`;
        params.push(departmentIds);
    }

    if (whereClause) {
        query += ' ' + whereClause;
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Получить единицу техники по ID
 */
const getUnitById = async (id) => {
    const result = await pool.query(`
    SELECT 
      u.id, u.name, u.type, u.plate_number, u.status, 
      u.department_id, u.created_at, u.updated_at,
      d.name as department_name
    FROM units u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = $1
  `, [id]);
    return result.rows[0] || null;
};

/**
 * Создать новую единицу техники
 */
const createUnit = async (data) => {
    const { name, type, plate_number, status, department_id } = data;
    const id = uuidv4();

    const result = await pool.query(
        `INSERT INTO units (id, name, type, plate_number, status, department_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, type, plate_number, status, department_id, created_at, updated_at`,
        [id, name, type, plate_number, status, department_id]
    );
    return result.rows[0];
};

/**
 * Обновить единицу техники
 */
const updateUnit = async (id, data) => {
    const { name, type, plate_number, status, department_id } = data;
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (type !== undefined) {
        fields.push(`type = $${paramIndex++}`);
        values.push(type);
    }
    if (plate_number !== undefined) {
        fields.push(`plate_number = $${paramIndex++}`);
        values.push(plate_number);
    }
    if (status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(status);
    }
    if (department_id !== undefined) {
        fields.push(`department_id = $${paramIndex++}`);
        values.push(department_id);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 0) {
        return getUnitById(id);
    }

    values.push(id);
    const query = `
    UPDATE units
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, type, plate_number, status, department_id, created_at, updated_at
  `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
};

/**
 * Удалить единицу техники
 */
const deleteUnit = async (id) => {
    const result = await pool.query('DELETE FROM units WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
};

module.exports = {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
};