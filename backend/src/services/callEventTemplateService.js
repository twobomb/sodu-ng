const pool = require('../db/pool');

// ---------------------------------------------------------------------------
// Типовые фразы хода событий.
// Общие (scope='global') видят все; личные (scope='personal') — только создатель.
// Функции возвращают записи с полями: id, text, scope, created_by, created_at.
// ---------------------------------------------------------------------------

const listForUser = async (userId) => {
    const res = await pool.query(
        `SELECT id, text, scope, created_by, created_at
         FROM call_event_templates
         WHERE scope = 'global' OR created_by = $1
         ORDER BY (scope = 'global') DESC, created_at ASC`,
        [userId]
    );
    return res.rows;
};

// Возвращает { existed, template } — существующую фразу (при дубле) или новую.
const createTemplate = async ({ text, scope, createdBy }) => {
    const whereClause =
        scope === 'global'
            ? "scope = 'global' AND lower(text) = lower($1)"
            : "scope = 'personal' AND created_by = $2 AND lower(text) = lower($1)";
    const params = scope === 'global' ? [text] : [text, createdBy];

    const existing = await pool.query(
        `SELECT id, text, scope, created_by, created_at
         FROM call_event_templates
         WHERE ${whereClause}
         LIMIT 1`,
        params
    );
    if (existing.rows.length > 0) {
        return { existed: true, template: existing.rows[0] };
    }

    const res = await pool.query(
        `INSERT INTO call_event_templates (text, scope, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, text, scope, created_by, created_at`,
        [text, scope, createdBy]
    );
    return { existed: false, template: res.rows[0] };
};

// Удаление по id. Возвращает:
//   { ok: true }                 — удалено (или уже не существует);
//   { ok: false, forbidden: true } — нет прав удалять эту фразу.
// Удаление идемпотентно: если записи с таким id нет — просто ok:true,
// чтобы устаревший id из старого списка не ронял интерфейс.
const deleteTemplate = async (id, userId, canManageGlobal) => {
    const row = await pool.query(
        `SELECT scope, created_by FROM call_event_templates WHERE id = $1`,
        [id]
    );
    const tpl = row.rows[0];
    if (!tpl) return { ok: true };

    const isOwner = tpl.created_by == null ? false : String(tpl.created_by) === String(userId);

    // Общие может удалять только имеющий право; личные — их создатель или имеющий право.
    if (canManageGlobal || (tpl.scope !== 'global' && isOwner)) {
        await pool.query(`DELETE FROM call_event_templates WHERE id = $1`, [id]);
        return { ok: true };
    }
    return { ok: false, forbidden: true };
};

module.exports = {
    listForUser,
    createTemplate,
    deleteTemplate,
};