const pool = require('../db/pool');

const getProfile = async (userId) => {
    const res = await pool.query(
        `
    SELECT
      u.id AS user_id, u.username,
      p.display_name, p.avatar_url, p.updated_at
    FROM users u
    LEFT JOIN user_chat_profiles p ON p.user_id = u.id
    WHERE u.id = $1
    `,
        [userId]
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    // Если профиля ещё нет — создаём дефолтный
    if (row.updated_at === null) {
        await pool.query(
            `INSERT INTO user_chat_profiles (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );
    }
    return row;
};

const updateProfile = async (userId, { display_name, avatar_url }) => {
    // Гарантируем существование строки
    await pool.query(
        `INSERT INTO user_chat_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );

    const fields = [];
    const values = [];
    let idx = 1;

    if (display_name !== undefined) {
        fields.push(`display_name = $${idx++}`);
        values.push(display_name || null);
    }
    if (avatar_url !== undefined) {
        fields.push(`avatar_url = $${idx++}`);
        values.push(avatar_url || null);
    }
    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const res = await pool.query(
        `UPDATE user_chat_profiles
         SET ${fields.join(', ')}
         WHERE user_id = $${idx}
             RETURNING user_id, display_name, avatar_url, updated_at`,
        values
    );
    return res.rows[0] || null;
};

// Кто прочитал конкретное сообщение
const getReaders = async (messageId) => {
    const msgRes = await pool.query(
        `SELECT conversation_id, created_at FROM messages WHERE id = $1`,
        [messageId]
    );
    if (!msgRes.rows.length) return null;
    const { conversation_id, created_at } = msgRes.rows[0];

    const res = await pool.query(
        `
    SELECT
      cm.user_id, u.username,
      p.display_name, p.avatar_url,
      CASE
        WHEN mr.last_read_at IS NOT NULL AND mr.last_read_at >= $2 THEN true
        ELSE false
      END AS has_read,
      mr.last_read_at
    FROM conversation_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN user_chat_profiles p ON p.user_id = u.id
    LEFT JOIN message_reads mr
      ON mr.conversation_id = cm.conversation_id AND mr.user_id = cm.user_id
    WHERE cm.conversation_id = $1
    ORDER BY has_read DESC, u.username ASC
    `,
        [conversation_id, created_at]
    );

    return { conversation_id, readers: res.rows };
};

module.exports = { getProfile, updateProfile, getReaders };