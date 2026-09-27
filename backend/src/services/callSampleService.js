const pool = require('../db/pool');
const { validateDefinition } = require('./callQueryBuilder');

// ============================================================
// СОХРАНЁННЫЕ ВЫБОРКИ ВЫЗОВОВ (конструктор запросов)
// ============================================================
const SELECT_SAMPLE = `
  s.id, s.name, s.definition, s.created_by, s.created_at, s.updated_at,
  u.username AS author_username
`;

const FROM_SAMPLE = `
  FROM call_samples s
  LEFT JOIN users u ON s.created_by = u.id
`;

const listSamples = async () => {
    const res = await pool.query(
        `SELECT ${SELECT_SAMPLE} ${FROM_SAMPLE} ORDER BY lower(s.name)`
    );
    return res.rows;
};

const getSampleById = async (id) => {
    const res = await pool.query(
        `SELECT ${SELECT_SAMPLE} ${FROM_SAMPLE} WHERE s.id = $1`,
        [id]
    );
    return res.rows[0] || null;
};

// Определение выборки по id (для применения фильтра в списке вызовов)
const getDefinition = async (id) => {
    if (!id) return null;
    const res = await pool.query('SELECT definition FROM call_samples WHERE id = $1', [id]);
    return res.rows[0]?.definition || null;
};

/**
 * Сохранить выборку.
 *  - если передан id — обновляем запись с этим id (переименование/пересохранение);
 *  - иначе ищем запись с таким же именем (без учёта регистра):
 *      нашли → обновляем (пересохранение), не нашли → создаём.
 */
const saveSample = async ({ id = null, name, definition, userId }) => {
    validateDefinition(definition);

    // Обновление по id
    if (id) {
        const res = await pool.query(
            `UPDATE call_samples
             SET name = $1, definition = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id`,
            [name, definition, id]
        );
        if (!res.rows.length) return null;
        return getSampleById(id);
    }

    // Поиск по имени и пересохранение
    const existing = await pool.query(
        'SELECT id FROM call_samples WHERE lower(name) = lower($1)',
        [name]
    );
    if (existing.rows.length) {
        const foundId = existing.rows[0].id;
        await pool.query(
            `UPDATE call_samples
             SET definition = $1, updated_at = NOW()
             WHERE id = $2`,
            [definition, foundId]
        );
        return getSampleById(foundId);
    }

    const created = await pool.query(
        `INSERT INTO call_samples (name, definition, created_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [name, definition, userId || null]
    );
    return getSampleById(created.rows[0].id);
};

const deleteSample = async (id) => {
    const res = await pool.query('DELETE FROM call_samples WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
};

module.exports = {
    listSamples,
    getSampleById,
    getDefinition,
    saveSample,
    deleteSample,
};
