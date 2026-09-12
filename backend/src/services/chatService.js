const pool = require('../db/pool');
const logger = require('../utils/logger');





// ============================================================
// ВСЕ ПОЛЬЗОВАТЕЛИ, ДОСТУПНЫЕ ДЛЯ ЧАТА
// ============================================================
const getChattableUsers = async (userId, query = '') => {
    const params = [userId];
    let where = 'WHERE u.id <> $1';

    if (query && query.trim()) {
        params.push(`%${query.trim()}%`);
        where += ` AND (u.username ILIKE $2 OR p.display_name ILIKE $2)`;
    }

    const res = await pool.query(
        `
    SELECT
      u.id, u.username,
      p.display_name, p.avatar_url,
      (SELECT c.id FROM conversations c
        WHERE c.type = 'direct'
          AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
          AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = u.id)
          AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
        LIMIT 1) AS direct_conversation_id
    FROM users u
    LEFT JOIN user_chat_profiles p ON p.user_id = u.id
    ${where}
    ORDER BY COALESCE(p.display_name, u.username) ASC
    LIMIT 200
    `,
        params
    );

    return res.rows;
};
// ============================================================
// BOOTSTRAP
// Гарантирует: пользователь подписан на "Общий", имеет "Избранное"
// и запись в user_chat_profiles. Идемпотентно.
// ============================================================
// ============================================================
// BOOTSTRAP
// Гарантирует: пользователь подписан на "Общий", имеет "Избранное"
// и запись в user_chat_profiles. Идемпотентно.
// ============================================================
const bootstrapUser = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // "Общий" канал
        const generalRes = await client.query(
            `SELECT id FROM conversations WHERE system_key = 'general' LIMIT 1`
        );
        if (!generalRes.rows.length) throw new Error('Общий канал не найден');
        const generalId = generalRes.rows[0].id;

        await client.query(
            `INSERT INTO conversation_members (conversation_id, user_id, role)
             VALUES ($1, $2, 'member')
                 ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [generalId, userId]
        );

        // "Избранное"
        const savedRes = await client.query(
            `SELECT id FROM conversations
             WHERE system_key = 'saved' AND owner_id = $1 LIMIT 1`,
            [userId]
        );
        let savedId;
        if (savedRes.rows.length) {
            savedId = savedRes.rows[0].id;
        } else {
            const newSaved = await client.query(
                `INSERT INTO conversations (type, name, is_system, system_key, owner_id, created_by)
                 VALUES ('saved', 'Избранное', true, 'saved', $1, $1)
                     RETURNING id`,
                [userId]
            );
            savedId = newSaved.rows[0].id;
            await client.query(
                `INSERT INTO conversation_members (conversation_id, user_id, role)
                 VALUES ($1, $2, 'admin')`,
                [savedId, userId]
            );
        }

        // Chat-профиль пользователя
        await client.query(
            `INSERT INTO user_chat_profiles (user_id) VALUES ($1)
                ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );

        await client.query('COMMIT');
        return { generalId, savedId };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ============================================================
// СПИСОК ЧАТОВ ПОЛЬЗОВАТЕЛЯ
// filter: 'all' | 'channels' | 'chats'
// ============================================================
const getUserConversations = async (userId, filter = 'all') => {
    let typeFilter = '';
    const params = [userId];

    if (filter === 'channels') {
        typeFilter = `AND c.type = 'channel'`;
    } else if (filter === 'chats') {
        typeFilter = `AND c.type IN ('direct','saved')`;
    }

    const result = await pool.query(
        `
    SELECT
      c.id, c.type, c.name, c.description, c.avatar_url,
      c.is_readonly, c.is_system, c.system_key, c.owner_id,
      c.last_message_at, c.created_at,
      cm.is_pinned, cm.pinned_at, cm.role AS my_role,
      cm.last_read_at,
      lm.id            AS last_message_id,
      lm.content       AS last_message_content,
      lm.content_type  AS last_message_type,
      lm.user_id       AS last_message_user_id,
      lm.created_at    AS last_message_created_at,
      lu.username         AS last_message_username,
      lp.display_name     AS last_message_display_name,
      (SELECT COUNT(*) FROM messages m2
        WHERE m2.conversation_id = c.id
          AND m2.deleted_at IS NULL
          AND m2.user_id <> $1
          AND (cm.last_read_at IS NULL OR m2.created_at > cm.last_read_at)
      ) AS unread_count,
      (SELECT COUNT(*) FROM conversation_members cm2
        WHERE cm2.conversation_id = c.id) AS members_count
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id AND cm.user_id = $1
    LEFT JOIN LATERAL (
      SELECT m.*
      FROM messages m
      WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
    LEFT JOIN users lu ON lu.id = lm.user_id
    LEFT JOIN user_chat_profiles lp ON lp.user_id = lm.user_id
    WHERE 1=1 ${typeFilter}
    ORDER BY
        -- 1. Системные чаты всегда сверху (Избранное, Общий)
        CASE
        WHEN c.system_key IN ('general', 'saved') THEN 0
        ELSE 1
    END ASC,
      -- 2. Внутри системных: сначала Избранное, потом Общий
      CASE c.system_key
        WHEN 'saved' THEN 0
        WHEN 'general' THEN 1
        ELSE 2
    END ASC,
      -- 3. Закреплённые пользователем чаты
      cm.is_pinned DESC,
      cm.pinned_at DESC NULLS LAST,
      -- 4. Обычные чаты по последнему сообщению
      c.last_message_at DESC NULLS LAST,
      c.created_at DESC
        `,
        params
    );

    // Для 'direct' — подменяем name/avatar на данные второго участника
    const directIds = result.rows
        .filter((r) => r.type === 'direct')
        .map((r) => r.id);

    if (directIds.length) {
        const peersRes = await pool.query(
            `
      SELECT
        cm.conversation_id,
        u.id, u.username,
        p.display_name, p.avatar_url
      FROM conversation_members cm
      JOIN users u ON u.id = cm.user_id
      LEFT JOIN user_chat_profiles p ON p.user_id = u.id
      WHERE cm.conversation_id = ANY($1::uuid[])
        AND cm.user_id <> $2
      `,
            [directIds, userId]
        );
        const peers = {};
        for (const p of peersRes.rows) peers[p.conversation_id] = p;

        for (const row of result.rows) {
            if (row.type === 'direct' && peers[row.id]) {
                row.name = peers[row.id].display_name || peers[row.id].username;
                row.avatar_url = peers[row.id].avatar_url;
                row.peer_user_id = peers[row.id].id;
            }
        }
    }

    return result.rows;
};

// ============================================================
// ОДИН ЧАТ
// ============================================================
const getConversationById = async (conversationId, userId) => {
    const res = await pool.query(
        `
    SELECT c.*, cm.role AS my_role, cm.is_pinned, cm.last_read_at,
      (SELECT COUNT(*) FROM conversation_members cm2
        WHERE cm2.conversation_id = c.id) AS members_count
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id AND cm.user_id = $2
    WHERE c.id = $1
    `,
        [conversationId, userId]
    );
    return res.rows[0] || null;
};

const isMember = async (conversationId, userId) => {
    const res = await pool.query(
        `SELECT 1 FROM conversation_members
     WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    return res.rows.length > 0;
};

// ============================================================
// СОЗДАНИЕ КАНАЛА/ГРУППЫ
// ============================================================
const createChannel = async (
    { name, description, is_readonly, allow_member_invites = true, memberIds = [] },
    creatorId
) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const convRes = await client.query(
            `INSERT INTO conversations
             (type, name, description, is_readonly, allow_member_invites, created_by)
             VALUES ('channel', $1, $2, $3, $4, $5)
                 RETURNING *`,
            [name, description || null, !!is_readonly, allow_member_invites !== false, creatorId]
        );
        const conversation = convRes.rows[0];

        // Создатель — админ
        await client.query(
            `INSERT INTO conversation_members (conversation_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
            [conversation.id, creatorId]
        );

        // Остальные участники — member
        const uniqueIds = [...new Set(memberIds.filter((id) => id !== creatorId))];
        for (const uid of uniqueIds) {
            await client.query(
                `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
                [conversation.id, uid]
            );
        }

        await client.query('COMMIT');
        return conversation;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ============================================================
// МОЖЕТ ЛИ ПОЛЬЗОВАТЕЛЬ ПРИГЛАШАТЬ В ЭТОТ ЧАТ
// ============================================================
const canInvite = async (conversationId, userId, hasManagePermission) => {
    const conv = await getRawConversation(conversationId);
    if (!conv) return { ok: false, reason: 'not_found' };

    // Admin канала всегда может
    const memberRes = await pool.query(
        `SELECT role FROM conversation_members
     WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    if (!memberRes.rows.length) return { ok: false, reason: 'not_member' };

    const myRole = memberRes.rows[0].role;
    if (myRole === 'admin') return { ok: true };
    if (hasManagePermission) return { ok: true };
    if (conv.allow_member_invites) return { ok: true };

    return { ok: false, reason: 'forbidden' };
};
// ============================================================
// ОБНОВЛЕНИЕ КАНАЛА
// ============================================================
const updateChannel = async (conversationId, data) => {
    const fields = [];
    const values = [];
    let idx = 1;
    if (data.allow_member_invites !== undefined) {
        fields.push(`allow_member_invites = $${idx++}`);
        values.push(!!data.allow_member_invites);
    }
    if (data.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(data.name);
    }
    if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
    }
    if (data.avatar_url !== undefined) {
        fields.push(`avatar_url = $${idx++}`);
        values.push(data.avatar_url);
    }
    if (data.is_readonly !== undefined) {
        fields.push(`is_readonly = $${idx++}`);
        values.push(!!data.is_readonly);
    }

    if (!fields.length) return getRawConversation(conversationId);

    fields.push(`updated_at = NOW()`);
    values.push(conversationId);

    const res = await pool.query(
        `UPDATE conversations SET ${fields.join(', ')}
     WHERE id = $${idx} RETURNING *`,
        values
    );
    return res.rows[0] || null;
};

const getRawConversation = async (id) => {
    const res = await pool.query(
        `SELECT * FROM conversations WHERE id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// ============================================================
// УДАЛЕНИЕ КАНАЛА
// ============================================================
const deleteChannel = async (conversationId) => {
    const res = await pool.query(
        `DELETE FROM conversations
     WHERE id = $1 AND is_system = false AND type = 'channel'
     RETURNING id`,
        [conversationId]
    );
    return res.rows.length > 0;
};

// ============================================================
// УЧАСТНИКИ
// ============================================================
const addMember = async (conversationId, userId, role = 'member') => {
    const res = await pool.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO NOTHING
     RETURNING *`,
        [conversationId, userId, role]
    );
    return res.rows[0] || null;
};

const removeMember = async (conversationId, userId) => {
    const res = await pool.query(
        `DELETE FROM conversation_members
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING user_id`,
        [conversationId, userId]
    );
    return res.rows.length > 0;
};
// ============================================================
// ВЫЙТИ ИЗ ЛИЧНОГО ЧАТА (убрать у себя, у собеседника остаётся)
// ============================================================
const leaveDirectConversation = async (conversationId, userId) => {
    const conv = await getRawConversation(conversationId);
    if (!conv) return { ok: false, reason: 'not_found' };

    if (conv.type !== 'direct') {
        return { ok: false, reason: 'not_direct' };
    }

    const res = await pool.query(
        `DELETE FROM conversation_members
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING user_id`,
        [conversationId, userId]
    );
    return { ok: res.rows.length > 0 };
};
const getMembers = async (conversationId) => {
    const res = await pool.query(
        `
            SELECT
                cm.user_id, cm.role, cm.joined_at, cm.last_read_at,
                u.username,
                u.role AS user_role,
                p.display_name, p.avatar_url
            FROM conversation_members cm
                     JOIN users u ON u.id = cm.user_id
                     LEFT JOIN user_chat_profiles p ON p.user_id = cm.user_id
            WHERE cm.conversation_id = $1
            ORDER BY
                CASE cm.role WHEN 'admin' THEN 0 ELSE 1 END,
                u.username ASC
        `,
        [conversationId]
    );
    return res.rows;
};

// ============================================================
// ЗАКРЕПЛЕНИЕ
// ============================================================
const pinConversation = async (conversationId, userId, pinned) => {
    // Проверяем лимит (из system_settings)
    const maxChatsRes = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'chat_max_pinned_chats'`
    );
    const maxChannelsRes = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'chat_max_pinned_channels'`
    );
    const maxChats = Number(maxChatsRes.rows[0]?.value) || 5;
    const maxChannels = Number(maxChannelsRes.rows[0]?.value) || 5;

    const conv = await getRawConversation(conversationId);
    if (!conv) return { ok: false, reason: 'not_found' };

    const isChannel = conv.type === 'channel';
    const limit = isChannel ? maxChannels : maxChats;

    if (pinned) {
        const countRes = await pool.query(
            `
      SELECT COUNT(*)::int AS n
      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id
      WHERE cm.user_id = $1
        AND cm.is_pinned = true
        AND c.type ${isChannel ? "= 'channel'" : "IN ('direct','saved')"}
      `,
            [userId]
        );
        const currentPinned = countRes.rows[0].n;
        if (currentPinned >= limit) {
            return { ok: false, reason: 'limit_reached', limit };
        }
    }

    await pool.query(
        `UPDATE conversation_members
     SET is_pinned = $3,
         pinned_at = CASE WHEN $3 THEN NOW() ELSE NULL END
     WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId, !!pinned]
    );

    return { ok: true };
};

// ============================================================
// ПРОЧТЕНИЯ
// ============================================================
const markAsRead = async (conversationId, userId, messageId = null) => {
    await pool.query(
        `INSERT INTO message_reads (conversation_id, user_id, last_read_message_id, last_read_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (conversation_id, user_id) DO UPDATE
     SET last_read_message_id = COALESCE($3, message_reads.last_read_message_id),
         last_read_at = NOW()`,
        [conversationId, userId, messageId]
    );
    // Дублируем в conversation_members для быстрого доступа
    await pool.query(
        `UPDATE conversation_members
     SET last_read_at = NOW()
     WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
};

// ============================================================
// ПОИСК ПО ЧАТАМ
// ============================================================
const searchConversations = async (userId, query) => {
    const res = await pool.query(
        `
    SELECT c.id, c.type, c.name, c.avatar_url, c.system_key
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
    WHERE c.name ILIKE $2
    ORDER BY c.name ASC
    LIMIT 30
    `,
        [userId, `%${query}%`]
    );
    return res.rows;
};

// ============================================================
// СОЗДАНИЕ ЛИЧНОГО ЧАТА (DIRECT)
// ============================================================
const getOrCreateDirect = async (userA, userB) => {
    if (userA === userB) throw new Error('Нельзя создать чат с самим собой');

    // Ищем существующий direct между двумя пользователями
    const existing = await pool.query(
        `
    SELECT c.id FROM conversations c
    WHERE c.type = 'direct'
      AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
      AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2)
      AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
    LIMIT 1
    `,
        [userA, userB]
    );
    if (existing.rows.length) return existing.rows[0].id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const convRes = await client.query(
            `INSERT INTO conversations (type, created_by)
       VALUES ('direct', $1) RETURNING id`,
            [userA]
        );
        const id = convRes.rows[0].id;

        await client.query(
            `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES
       ($1, $2, 'member'), ($1, $3, 'member')`,
            [id, userA, userB]
        );

        await client.query('COMMIT');
        return id;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
// ============================================================
// ПОЛЬЗОВАТЕЛИ, КОТОРЫХ МОЖНО ПРИГЛАСИТЬ (ещё не в чате)
// ============================================================
const getInvitableUsers = async (conversationId, query = '') => {
    const params = [conversationId];
    let where = '';

    if (query && query.trim()) {
        params.push(`%${query.trim()}%`);
        where = `AND (u.username ILIKE $2 OR p.display_name ILIKE $2)`;
    }

    const res = await pool.query(
        `
    SELECT
      u.id, u.username,
      p.display_name, p.avatar_url
    FROM users u
    LEFT JOIN user_chat_profiles p ON p.user_id = u.id
    WHERE NOT EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = $1 AND cm.user_id = u.id
    )
      AND u.is_blocked = false
      ${where}
    ORDER BY COALESCE(p.display_name, u.username) ASC
    LIMIT 100
    `,
        params
    );

    return res.rows;
};

module.exports = {
    bootstrapUser,
    getUserConversations,
    getConversationById,
    isMember,
    createChannel,
    updateChannel,
    deleteChannel,
    addMember,
    removeMember,
    getMembers,
    pinConversation,
    markAsRead,
    searchConversations,
    getOrCreateDirect,
    getRawConversation,
    leaveDirectConversation,
    getChattableUsers,
    canInvite,
    getInvitableUsers
};