const pool = require('../db/pool');
const attachmentService = require('./attachmentService');

// ============================================================
// ПОЛУЧЕНИЕ СООБЩЕНИЙ С ПАГИНАЦИЕЙ (cursor-based)
// Курсор — это created_at + id последнего сообщения.
// Возвращает сообщения в обратном порядке (свежие в конце).
// ============================================================
const getMessages = async (conversationId, { before = null, limit = 30 } = {}) => {
    const params = [conversationId];
    let cursorWhere = '';

    if (before) {
        // before = { created_at, id }
        params.push(before.created_at, before.id);
        cursorWhere = `AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)`;
    }

    params.push(limit + 1); // +1, чтобы узнать, есть ли ещё

    const res = await pool.query(
        `
    SELECT
      m.id, m.conversation_id, m.user_id, m.content, m.content_type,
      m.reply_to_id, m.edited_at, m.deleted_at, m.created_at,
      u.username,
      u.role AS user_role,
      p.display_name, p.avatar_url,
      rm.id            AS reply_message_id,
      rm.content       AS reply_content,
      rm.content_type  AS reply_content_type,
      rm.deleted_at    AS reply_deleted_at,
      ru.username         AS reply_username,
      rp.display_name     AS reply_display_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'original_name', a.original_name,
          'mime_type', a.mime_type,
          'size', a.size,
          'width', a.width,
          'height', a.height
        ) ORDER BY a.created_at)
        FROM attachments a WHERE a.message_id = m.id),
        '[]'::json
      ) AS attachments
    FROM messages m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN user_chat_profiles p ON p.user_id = m.user_id
    LEFT JOIN messages rm ON rm.id = m.reply_to_id
    LEFT JOIN users ru ON ru.id = rm.user_id
    LEFT JOIN user_chat_profiles rp ON rp.user_id = rm.user_id
    WHERE m.conversation_id = $1
      ${cursorWhere}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT $${params.length}
    `,
        params
    );

    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    // Возвращаем в прямом порядке (старые → новые)
    const messages = rows.reverse();

    // Формируем next-курсор — самый старый из отданных
    const oldest = messages[0];
    const nextCursor = hasMore && oldest
        ? { created_at: oldest.created_at, id: oldest.id }
        : null;

    return { messages, nextCursor, hasMore };
};

// ============================================================
// СОЗДАНИЕ СООБЩЕНИЯ
// ============================================================
// ============================================================
// СОЗДАНИЕ СООБЩЕНИЯ
// ============================================================
const createMessage = async ({
                                 conversationId,
                                 userId,
                                 content,
                                 contentType = 'text',
                                 replyToId = null,
                                 attachmentIds = [],
                             }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const res = await client.query(
            `INSERT INTO messages
                 (conversation_id, user_id, content, content_type, reply_to_id)
             VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
            [conversationId, userId, content, contentType, replyToId]
        );
        const message = res.rows[0];

        // Привязка файлов
        if (attachmentIds.length) {
            await client.query(
                `UPDATE attachments
                 SET message_id = $1
                 WHERE id = ANY($2::uuid[])
                   AND message_id IS NULL
                   AND conversation_id = $3`,
                [message.id, attachmentIds, conversationId]
            );
        }

        await client.query(
            `UPDATE conversations SET last_message_at = $2, updated_at = NOW()
             WHERE id = $1`,
            [conversationId, message.created_at]
        );

        await client.query('COMMIT');
        return message;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
// ============================================================
// ПОЛУЧЕНИЕ ОДНОГО СООБЩЕНИЯ С ДОП. ДАННЫМИ
// ============================================================
const getMessageById = async (messageId) => {
    const res = await pool.query(
        `
    SELECT
      m.id, m.conversation_id, m.user_id, m.content, m.content_type,
      m.reply_to_id, m.edited_at, m.deleted_at, m.created_at,
      u.username,
      u.role AS user_role,
      p.display_name, p.avatar_url,
      rm.id            AS reply_message_id,
      rm.content       AS reply_content,
      rm.content_type  AS reply_content_type,
      rm.deleted_at    AS reply_deleted_at,
      ru.username         AS reply_username,
      rp.display_name     AS reply_display_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'original_name', a.original_name,
          'mime_type', a.mime_type,
          'size', a.size,
          'width', a.width,
          'height', a.height
        ) ORDER BY a.created_at)
        FROM attachments a WHERE a.message_id = m.id),
        '[]'::json
      ) AS attachments
    FROM messages m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN user_chat_profiles p ON p.user_id = m.user_id
    LEFT JOIN messages rm ON rm.id = m.reply_to_id
    LEFT JOIN users ru ON ru.id = rm.user_id
    LEFT JOIN user_chat_profiles rp ON rp.user_id = rm.user_id
    WHERE m.id = $1
    `,
        [messageId]
    );
    return res.rows[0] || null;
};

// ============================================================
// РЕДАКТИРОВАНИЕ
// Проверяем: автор, окно редактирования, не удалено
// ============================================================
const editMessage = async (messageId, userId, newContent, editWindowMinutes = 10) => {
    const existing = await getMessageById(messageId);
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.deleted_at) return { ok: false, reason: 'deleted' };
    if (existing.user_id !== userId) return { ok: false, reason: 'forbidden' };
    if (existing.content_type !== 'text') return { ok: false, reason: 'not_text' };

    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    const limitMs = editWindowMinutes * 60 * 1000;
    if (ageMs > limitMs) return { ok: false, reason: 'expired', limit: editWindowMinutes };

    const res = await pool.query(
        `UPDATE messages
     SET content = $2, edited_at = NOW()
     WHERE id = $1
     RETURNING *`,
        [messageId, newContent]
    );
    return { ok: true, message: res.rows[0] };
};

// ============================================================
// УДАЛЕНИЕ (soft delete)
// Автор может в любое время. Модератор (chat.moderate) — тоже.
// ============================================================
const deleteMessage = async (messageId, userId, canModerate = false) => {
    const existing = await getMessageById(messageId);
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.deleted_at) return { ok: true, message: existing }; // идемпотентно

    if (!canModerate && existing.user_id !== userId) {
        return { ok: false, reason: 'forbidden' };
    }

    // Удаляем вложения: записи в БД и физические файлы из uploads/
    await attachmentService.deleteAttachmentsForMessage(messageId);

    const res = await pool.query(
        `UPDATE messages
     SET deleted_at = NOW(), content = NULL
     WHERE id = $1
     RETURNING *`,
        [messageId]
    );
    return { ok: true, message: res.rows[0] };
};

// ============================================================
// КТО ПРОЧИТАЛ СООБЩЕНИЕ (только для групп/каналов)
// ============================================================
const getMessageReaders = async (messageId) => {
    // Находим разговор
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
      (mr.last_read_at IS NOT NULL AND mr.last_read_at >= $2) AS has_read
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

// ============================================================
// ПОЛУЧИТЬ НАСТРОЙКУ ОКНА РЕДАКТИРОВАНИЯ
// ============================================================
const getEditWindowMinutes = async () => {
    const res = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'chat_edit_window_minutes'`
    );
    const n = Number(res.rows[0]?.value);
    return Number.isFinite(n) ? n : 10;
};
// ============================================================
// СОЗДАНИЕ СИСТЕМНОГО СООБЩЕНИЯ
// ============================================================
const createSystemMessage = async ({ conversationId, actorId, content }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const res = await client.query(
            `INSERT INTO messages
        (conversation_id, user_id, content, content_type)
       VALUES ($1, $2, $3, 'system')
       RETURNING *`,
            [conversationId, actorId, content]
        );
        const message = res.rows[0];

        await client.query(
            `UPDATE conversations SET last_message_at = $2, updated_at = NOW()
       WHERE id = $1`,
            [conversationId, message.created_at]
        );

        await client.query('COMMIT');
        return message;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
module.exports = {
    getMessages,
    createMessage,
    getMessageById,
    editMessage,
    createSystemMessage,
    deleteMessage,
    getMessageReaders,
    getEditWindowMinutes,
};