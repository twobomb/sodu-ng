const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;

/**
 * Получить всех пользователей с их подразделениями
 */
const getAllUsers = async () => {
    const result = await pool.query(`
        SELECT
            u.id, u.username, u.role, u.can_view_all, u.is_blocked,
            u.created_at, u.updated_at,
            COALESCE(
                    json_agg(
                            json_build_object('id', d.id, 'name', d.name)
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'
            ) AS departments
        FROM users u
                 LEFT JOIN user_departments ud ON u.id = ud.user_id
                 LEFT JOIN departments d ON ud.department_id = d.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `);
    return result.rows;
};
/**
 * Найти пользователя по ID (с подразделениями)
 */
const getUserById = async (id) => {
    const result = await pool.query(`
        SELECT
            u.id, u.username, u.role, u.can_view_all, u.is_blocked,
            u.created_at, u.updated_at,
            COALESCE(
                    json_agg(
                            json_build_object('id', d.id, 'name', d.name)
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'
            ) AS departments
        FROM users u
                 LEFT JOIN user_departments ud ON u.id = ud.user_id
                 LEFT JOIN departments d ON ud.department_id = d.id
        WHERE u.id = $1
        GROUP BY u.id
    `, [id]);
    return result.rows[0] || null;
};

/**
 * Создать нового пользователя (с хешированием пароля)
 * @param {Object} data - { username, password, role, can_view_all, departmentIds }
 * @returns {Object} созданный пользователь (без пароля)
 */
const createUser = async ({ username, password, role, can_view_all = false, departmentIds = [] }) => {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // Начинаем транзакцию
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Вставка пользователя
        const userResult = await client.query(
            `INSERT INTO users (id, username, password_hash, role, can_view_all)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, role, can_view_all, created_at, updated_at`,
            [userId, username, hashed, role, can_view_all]
        );
        const newUser = userResult.rows[0];

        // Привязка к подразделениям
        if (departmentIds && departmentIds.length > 0) {
            for (const depId of departmentIds) {
                await client.query(
                    `INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2)`,
                    [userId, depId]
                );
            }
        }

        await client.query('COMMIT');
        return newUser;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Обновить пользователя (пароль обновляется только если передан)
 */
const updateUser = async (id, { username, password, role, can_view_all, departmentIds, is_blocked }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Собираем поля для обновления
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (username !== undefined) {
            updates.push(`username = $${paramIndex++}`);
            values.push(username);
        }
        if (password) {
            const hashed = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(hashed);
        }
        if (role !== undefined) {
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }
        if (can_view_all !== undefined) {
            updates.push(`can_view_all = $${paramIndex++}`);
            values.push(can_view_all);
        }
        if (is_blocked !== undefined) {
            updates.push(`is_blocked = $${paramIndex++}`);
            values.push(is_blocked);
        }
        // Всегда обновляем updated_at
        updates.push(`updated_at = NOW()`);

        if (updates.length > 0) {
            const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, role, can_view_all, created_at, updated_at
      `;
            values.push(id);
            const result = await client.query(query, values);
            if (!result.rows.length) {
                throw new Error('User not found');
            }
            var updatedUser = result.rows[0];
        } else {
            // Если нечего обновлять, просто получаем пользователя
            const result = await client.query(
                `SELECT id, username, role, can_view_all, created_at, updated_at FROM users WHERE id = $1`,
                [id]
            );
            if (!result.rows.length) {
                throw new Error('User not found');
            }
            updatedUser = result.rows[0];
        }

        // Обновляем подразделения: удаляем старые и вставляем новые
        if (departmentIds !== undefined) {
            // Удаляем старые связи
            await client.query('DELETE FROM user_departments WHERE user_id = $1', [id]);
            // Вставляем новые
            for (const depId of departmentIds) {
                await client.query(
                    `INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2)`,
                    [id, depId]
                );
            }
        }

        if (is_blocked === true) {
            await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
        }
        await client.query('COMMIT');

        return updatedUser;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Удалить пользователя (каскадно удалит сессии и связи)
 */
const deleteUser = async (id) => {
    const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows.length > 0;
};

const blockUser = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE users SET is_blocked = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, is_blocked`,
            [id]
        );

        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return null;
        }

        // Удаляем все активные сессии пользователя
        await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);

        await client.query('COMMIT');
        return result.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const unblockUser = async (id) => {
    const result = await pool.query(
        `UPDATE users SET is_blocked = false, updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, is_blocked`,
        [id]
    );
    return result.rows[0] || null;
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
};