const pool = require('../db/pool');

/**
 * Записывает факт успешного входа пользователя.
 * Не бросает исключения наружу при сбое записи — логирование не должно
 * блокировать сам вход (вызывающий код оборачивает в try/catch).
 */
const recordLogin = async ({ userId, username, ip }) => {
    await pool.query(
        `INSERT INTO login_history (user_id, username, ip)
         VALUES ($1, $2, $3)`,
        [userId, username, ip || null]
    );
};

/**
 * Возвращает историю входов с фильтрами и пагинацией.
 *  - userId: только указанный пользователь
 *  - search: поиск по username (без учёта регистра)
 *  - limit / offset: пагинация
 */
const getLoginHistory = async ({ userId, search, limit = 50, offset = 0 }) => {
    const conditions = [];
    const params = [];

    if (userId) {
        params.push(userId);
        conditions.push(`lh.user_id = $${params.length}`);
    }

    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        conditions.push(`lh.username ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM login_history lh ${where}`,
        params
    );
    const total = countRes.rows[0]?.total || 0;

    params.push(limit);
    params.push(offset);
    const limitIndex = params.length - 1;

    const dataRes = await pool.query(
        `SELECT
            lh.id, lh.user_id, lh.username, lh.ip, lh.created_at
         FROM login_history lh
         ${where}
         ORDER BY lh.created_at DESC
         LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
        params
    );

    return { total, items: dataRes.rows };
};

module.exports = { recordLogin, getLoginHistory };