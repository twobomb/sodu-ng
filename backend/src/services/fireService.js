const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

/**
 * Получить подразделения, доступные пользователю (если can_view_all, то null - все)
 */
const getUserDepartments = async (userId, canViewAll) => {
    if (canViewAll) return null; // все
    const result = await pool.query(
        `SELECT department_id FROM user_departments WHERE user_id = $1`,
        [userId]
    );
    return result.rows.map(row => row.department_id);
};

/**
 * Получить список пожаров с фильтрацией по доступу пользователя
 */
const getFires = async (userId, canViewAll) => {
    let query = `
    SELECT 
      f.id, f.title, f.description, f.address, f.lat, f.lng, f.status,
      f.department_id, f.created_by, f.created_at, f.updated_at,
      d.name as department_name,
      u.username as creator_username
    FROM fires f
    LEFT JOIN departments d ON f.department_id = d.id
    LEFT JOIN users u ON f.created_by = u.id
  `;
    const params = [];

    if (!canViewAll) {
        // Получаем подразделения пользователя
        const deps = await getUserDepartments(userId, false);
        if (deps.length === 0) {
            // Если у пользователя нет подразделений, возвращаем пустой массив
            return [];
        }
        query += ` WHERE f.department_id = ANY($1)`;
        params.push(deps);
    }
    query += ` ORDER BY f.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Получить один пожар по ID с проверкой доступа
 */
const getFireById = async (id, userId, canViewAll) => {
    // Сначала получаем пожар
    const result = await pool.query(
        `SELECT f.*, d.name as department_name, u.username as creator_username
     FROM fires f
     LEFT JOIN departments d ON f.department_id = d.id
     LEFT JOIN users u ON f.created_by = u.id
     WHERE f.id = $1`,
        [id]
    );
    if (!result.rows.length) return null;
    const fire = result.rows[0];

    // Проверяем доступ
    if (!canViewAll) {
        const userDeps = await getUserDepartments(userId, false);
        if (!userDeps.includes(fire.department_id)) {
            return null; // нет доступа
        }
    }
    return fire;
};

/**
 * Создать пожар
 */
const createFire = async (data, userId) => {
    const { title, description, address, lat, lng, status, department_id } = data;
    const id = uuidv4();
    const result = await pool.query(
        `INSERT INTO fires (id, title, description, address, lat, lng, status, department_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [id, title, description, address, lat, lng, status, department_id, userId]
    );
    return result.rows[0];
};

/**
 * Обновить пожар (только если пользователь имеет доступ к его подразделению)
 */
const updateFire = async (id, data, userId, canViewAll) => {
    // Сначала проверим существование и доступ
    const existing = await getFireById(id, userId, canViewAll);
    if (!existing) return null;

    // Собираем поля для обновления
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const { title, description, address, lat, lng, status, department_id } = data;
    if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (address !== undefined) {
        updates.push(`address = $${paramIndex++}`);
        values.push(address);
    }
    if (lat !== undefined) {
        updates.push(`lat = $${paramIndex++}`);
        values.push(lat);
    }
    if (lng !== undefined) {
        updates.push(`lng = $${paramIndex++}`);
        values.push(lng);
    }
    if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
    }
    if (department_id !== undefined) {
        // Проверяем, что пользователь имеет доступ к новому department_id (если не can_view_all)
        if (!canViewAll) {
            const userDeps = await getUserDepartments(userId, false);
            if (!userDeps.includes(department_id)) {
                throw new Error('Нет доступа к указанному подразделению');
            }
        }
        updates.push(`department_id = $${paramIndex++}`);
        values.push(department_id);
    }

    // Всегда обновляем updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
        // Если нет полей для обновления, возвращаем существующий
        return existing;
    }

    const query = `
    UPDATE fires 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
    values.push(id);
    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * Удалить пожар (с проверкой доступа)
 */
const deleteFire = async (id, userId, canViewAll) => {
    // Проверяем доступ
    const existing = await getFireById(id, userId, canViewAll);
    if (!existing) return false;

    const result = await pool.query(
        'DELETE FROM fires WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows.length > 0;
};

module.exports = {
    getFires,
    getFireById,
    createFire,
    updateFire,
    deleteFire,
    getUserDepartments, // экспортируем для возможного использования
};