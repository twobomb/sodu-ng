const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// ПРОВЕРКА ГЛУБИНЫ ИЕРАРХИИ
// Разрешаем максимум 2 уровня: корень (parent_id = NULL) и дети.
// ============================================================

/**
 * Возвращает true, если у указанного подразделения есть дети.
 */
const hasChildren = async (departmentId) => {
    const res = await pool.query(
        'SELECT 1 FROM departments WHERE parent_id = $1 LIMIT 1',
        [departmentId]
    );
    return res.rows.length > 0;
};

/**
 * Получить все подразделения с построением дерева (опционально)
 * Вернём плоский список с полем parent_id
 */
const getAllDepartments = async () => {
    const result = await pool.query(`
        SELECT d.id, d.name, d.full_name, d.address, d.phone, d.parent_id, d.sort_order,
               d.municipality_id, m.name AS municipality_name,
               d.department_type_id, dt.name AS department_type_name,
               d.garrison_id, g.name AS garrison_name,
               d.show_in_line_note,
               d.created_at, d.updated_at
        FROM departments d
        LEFT JOIN municipalities m ON d.municipality_id = m.id
        LEFT JOIN department_types dt ON d.department_type_id = dt.id
        LEFT JOIN garrisons g ON d.garrison_id = g.id
        ORDER BY d.parent_id NULLS FIRST, d.sort_order ASC, d.name ASC
    `);
    return result.rows;
};

/**
 * Массово обновляет позиции и родителей
 * @param {Array<{id, parent_id, sort_order}>} updates
 */
const reorderDepartments = async (updates) => {
    // Проверяем все перемещения ДО транзакции
    for (const u of updates) {
        if (u.parent_id) {
            // 1. Родитель должен быть корневым
            const check = await validateParentIsRoot(u.parent_id);
            if (!check.ok) {
                const err = new Error(
                    'Вложенность ограничена 2 уровнями. Родителем может быть только корневое подразделение'
                );
                err.status = 400;
                throw err;
            }

            // 2. Нельзя в своего потомка
            const wouldCycle = await isDescendantOf(u.parent_id, u.id);
            if (wouldCycle) {
                const err = new Error(
                    'Нельзя переместить подразделение внутрь собственного потомка'
                );
                err.status = 400;
                throw err;
            }

            // 3. Нельзя перемещать узел с детьми в другого родителя
            const kids = await hasChildren(u.id);
            if (kids) {
                const err = new Error(
                    'Нельзя переместить подразделение с детьми под другого родителя'
                );
                err.status = 400;
                throw err;
            }
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const u of updates) {
            await client.query(
                `UPDATE departments
         SET parent_id = $1, sort_order = $2, updated_at = NOW()
         WHERE id = $3`,
                [u.parent_id, u.sort_order, u.id]
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
/**
 * Найти подразделение по ID
 */
const getDepartmentById = async (id) => {
    const result = await pool.query(
        `SELECT d.id, d.name, d.full_name, d.address, d.phone, d.parent_id, d.sort_order,
                d.municipality_id, m.name AS municipality_name,
                d.department_type_id, dt.name AS department_type_name,
                d.garrison_id, g.name AS garrison_name,
                d.created_at, d.updated_at
         FROM departments d
         LEFT JOIN municipalities m ON d.municipality_id = m.id
         LEFT JOIN department_types dt ON d.department_type_id = dt.id
         LEFT JOIN garrisons g ON d.garrison_id = g.id
         WHERE d.id = $1`,
        [id]
    );
    return result.rows[0] || null;
};
/**
 * Создать новое подразделение
 * @param {Object} data - { name, parent_id }
 */
const createDepartment = async ({ name, full_name, address, phone, parent_id, municipality_id, department_type_id, garrison_id, show_in_line_note }) => {
    const check = await validateParentIsRoot(parent_id);
    if (!check.ok) {
        if (check.reason === 'parent_not_found') {
            const err = new Error('Родительское подразделение не найдено');
            err.status = 400;
            throw err;
        }
        if (check.reason === 'parent_not_root') {
            const err = new Error(
                'Вложенность ограничена 2 уровнями. Родителем может быть только корневое подразделение'
            );
            err.status = 400;
            throw err;
        }
    }

    const id = uuidv4();
    const res = await pool.query(
        `INSERT INTO departments (id, name, full_name, address, phone, parent_id, municipality_id, department_type_id, garrison_id, show_in_line_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, name, full_name, address, phone, parent_id, sort_order,
               municipality_id, department_type_id, garrison_id, show_in_line_note, created_at, updated_at`,
        [
            id,
            name,
            full_name || null,
            address || null,
            phone || null,
            parent_id || null,
            municipality_id || null,
            department_type_id || null,
            garrison_id || null,
            show_in_line_note !== undefined ? Boolean(show_in_line_note) : true,
        ]
    );
    return res.rows[0];
};
/**
 * Обновить подразделение (проверка на циклическую ссылку)
 */
const updateDepartment = async (id, data) => {
    const { name, full_name, address, phone, parent_id, municipality_id, department_type_id, garrison_id, show_in_line_note } = data;

    // ...существующая валидация parent_id без изменений...

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(name);
    }
    if (full_name !== undefined) {
        fields.push(`full_name = $${idx++}`);
        values.push(full_name || null);
    }
    if (address !== undefined) {
        fields.push(`address = $${idx++}`);
        values.push(address || null);
    }
    if (phone !== undefined) {
        fields.push(`phone = $${idx++}`);
        values.push(phone || null);
    }
    if (parent_id !== undefined) {
        fields.push(`parent_id = $${idx++}`);
        values.push(parent_id || null);
    }
    if (municipality_id !== undefined) {
        fields.push(`municipality_id = $${idx++}`);
        values.push(municipality_id || null);
    }
    if (department_type_id !== undefined) {
        fields.push(`department_type_id = $${idx++}`);
        values.push(department_type_id || null);
    }
    if (garrison_id !== undefined) {
        fields.push(`garrison_id = $${idx++}`);
        values.push(garrison_id || null);
    }
    if (show_in_line_note !== undefined) {
        fields.push(`show_in_line_note = $${idx++}`);
        values.push(Boolean(show_in_line_note));
    }

    if (!fields.length) {
        const cur = await pool.query(
            'SELECT * FROM departments WHERE id = $1',
            [id]
        );
        return cur.rows[0] || null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await pool.query(
        `UPDATE departments SET ${fields.join(', ')}
         WHERE id = $${idx}
             RETURNING id, name, full_name, address, phone, parent_id, sort_order,
               municipality_id, department_type_id, garrison_id, show_in_line_note, created_at, updated_at`,
        values
    );
    return res.rows[0] || null;
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
/**
 * Проверяет, является ли potentialChild потомком ancestorId.
 */
const isDescendantOf = async (potentialChildId, ancestorId) => {
    let currentId = potentialChildId;
    const visited = new Set();

    while (currentId) {
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        if (currentId === ancestorId) return true;

        const result = await pool.query(
            'SELECT parent_id FROM departments WHERE id = $1',
            [currentId]
        );
        if (!result.rows.length) return false;
        currentId = result.rows[0].parent_id;
    }
    return false;
};


/**
 * Проверяет, что parentId — корневое подразделение (parent_id = NULL).
 * Возвращает { ok, reason }.
 */
const validateParentIsRoot = async (parentId) => {
    if (!parentId) return { ok: true }; // создаём корневое — ок

    const res = await pool.query(
        'SELECT id, parent_id FROM departments WHERE id = $1',
        [parentId]
    );
    if (!res.rows.length) {
        return { ok: false, reason: 'parent_not_found' };
    }
    if (res.rows[0].parent_id) {
        return { ok: false, reason: 'parent_not_root' };
    }
    return { ok: true };
};


module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
    isDescendantOf,
    hasChildren,
    validateParentIsRoot
};