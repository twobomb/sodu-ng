const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { generateToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

/**
 * Находит пользователя по username
 */
const findUserByUsername = async (username) => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
};

/**
 * Создаёт нового пользователя (только для админов, но пока без проверки)
 */
const createUser = async ({ username, password, role, can_view_all = false }) => {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, can_view_all)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, role, can_view_all, created_at`,
        [username, hashed, role, can_view_all]
    );
    return result.rows[0];
};

/**
 * Проверяет логин и возвращает пользователя, если пароль верен
 */
const authenticateUser = async (username, password) => {
    const user = await findUserByUsername(username);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return null;
    // Возвращаем пользователя без хеша пароля
    const { password_hash, ...userWithoutHash } = user;
    return userWithoutHash;
};

/**
 * Создаёт сессию для пользователя (токен) и удаляет все старые сессии этого пользователя (кроме новой)
 * Возвращает созданную сессию с токеном
 */
const createSession = async (userId) => {
    // Генерируем токен с payload { userId, role } (роль возьмём из БД)
    const user = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) throw new Error('User not found');
    const role = user.rows[0].role;

    const payload = { userId, role };
    const token = generateToken(payload);

    // Вставляем новую сессию
    const result = await pool.query(
        `INSERT INTO sessions (user_id, token, last_active_at)
     VALUES ($1, $2, NOW())
     RETURNING id, token, last_active_at, created_at`,
        [userId, token]
    );
    const newSession = result.rows[0];

    // Удаляем все остальные сессии этого пользователя (кроме только что созданной)
    await pool.query(
        'DELETE FROM sessions WHERE user_id = $1 AND id != $2',
        [userId, newSession.id]
    );

    return newSession;
};

/**
 * Удаляет сессию по токену (выход)
 */
const deleteSessionByToken = async (token) => {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
};

/**
 * Проверяет, активна ли сессия (по токену), и обновляет last_active_at
 */
const touchSession = async (token) => {
    const result = await pool.query(
        `UPDATE sessions SET last_active_at = NOW()
     WHERE token = $1
     RETURNING user_id`,
        [token]
    );
    return result.rows[0] || null;
};

module.exports = {
    findUserByUsername,
    createUser,
    authenticateUser,
    createSession,
    deleteSessionByToken,
    touchSession,
};