const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

/**
 * Получить все подразделения с построением дерева (опционально)
 * Вернём плоский список с полем parent_id
 */
const getAllDepartments = async () => {
    const result = await pool.query(`
    SELECT id, name, parent_id, created_at, updated_at
    FROM departments
    ORDER BY name
  `);
    return result.rows;
};

/**
 * Найти подразделение по ID
 */
const getDepartmentById = async (id) => {
    const result = await pool.query(
        `SELECT id, name, parent_id, created_at, updated_at
     FROM departments WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

/**
 * Создать новое подразделение
 * @param {Object} data - { name, parent_id }
 */
const createDepartment = async ({ name, parent_id }) => {
    const id = uuidv4();
    // Проверяем, существует ли parent_id (если указан)
    if (parent_id) {
        const parent = await pool.query('SELECT id FROM departments WHERE id = $1', [parent_id]);
        if (!parent.rows.length) {
            throw new Error('Родительское подразделение не найдено');
        }
    }
    const result = await pool.query(
        `INSERT INTO departments (id, name, parent_id)
     VALUES ($1, $2, $3)
     RETURNING id, name, parent_id, created_at, updated_at`,
        [id, name, parent_id || null]
    );
    return result.rows[0];
};

/**
 * Обновить подразделение (проверка на циклическую ссылку)
 */
const updateDepartment = async (id, { name, parent_id }) => {
    // Проверяем существование
    const existing = await pool.query('SELECT id FROM departments WHERE id = $1', [id]);
    if (!existing.rows.length) {
        throw new Error('Подразделение не найдено');
    }

    // Если меняется parent_id, проверяем, что не создаётся цикл
    if (parent_id !== undefined) {
        // Если parent_id == id, запрещаем
        if (parent_id === id) {
            throw new Error('Подразделение не может быть родителем самого себя');
        }
        // Проверяем, существует ли родитель
        if (parent_id) {
            const parent = await pool.query('SELECT id FROM departments WHERE id = $1', [parent_id]);
            if (!parent.rows.length) {
                throw new Error('Родительское подразделение не найдено');
            }
            // Проверка на циклическую зависимость: parent_id не должен быть потомком текущего
            const isDescendant = await checkIfDescendant(parent_id, id);
            if (isDescendant) {
                throw new Error('Невозможно установить родителя, так как это создаст циклическую зависимость');
            }
        }
    }

    // Формируем запрос на обновление
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (parent_id !== undefined) {
        updates.push(`parent_id = $${paramIndex++}`);
        values.push(parent_id || null);
    }
    // Всегда updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
        // Если нечего обновлять, возвращаем текущие данные
        return await getDepartmentById(id);
    }

    const query = `
    UPDATE departments 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, parent_id, created_at, updated_at
  `;
    values.push(id);
    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * Вспомогательная функция: проверяет, является ли потенциальный родитель потомком данного узла
 */
const checkIfDescendant = async (potentialParentId, nodeId) => {
    // Рекурсивно поднимаемся от potentialParentId к корню, проверяем, не встретим ли nodeId
    let currentId = potentialParentId;
    while (currentId) {
        if (currentId === nodeId) {
            return true;
        }
        const result = await pool.query('SELECT parent_id FROM departments WHERE id = $1', [currentId]);
        if (!result.rows.length) break;
        currentId = result.rows[0].parent_id;
    }
    return false;
};

/**
 * Удалить подразделение (только если нет дочерних)
 */
const deleteDepartment = async (id) => {
    // Проверяем, есть ли дочерние
    const children = await pool.query('SELECT id FROM departments WHERE parent_id = $1', [id]);
    if (children.rows.length > 0) {
        throw new Error('Невозможно удалить подразделение, так как у него есть дочерние');
    }
    const result = await pool.query(
        'DELETE FROM departments WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows.length > 0;
};

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
};