/**
 * Справочники параметров и значений блока «Объекты».
 *
 * Параметры (call_object_params) — глобальный список; добавлять/удалять может
 * пользователь с правом calls.manage_object_params (проверяется в контроллере).
 * Значения (call_object_param_values) привязаны к имени параметра.
 *
 * Уникальность:
 *   • параметры — без учёта регистра (уникальный индекс lower(name));
 *   • значения — без учёта регистра по паре (параметр, значение).
 */
const pool = require('../db/pool');

// Полный каталог: параметры + значения (для автодополнения в карточке и отчёте)
const listCatalog = async () => {
    const [paramsRes, valuesRes] = await Promise.all([
        pool.query(
            `SELECT id, name, created_by, created_at
             FROM call_object_params
             ORDER BY lower(name)`
        ),
        pool.query(
            `SELECT id, param_name, value, created_by, created_at
             FROM call_object_param_values
             ORDER BY lower(param_name), lower(value)`
        ),
    ]);
    return { params: paramsRes.rows, values: valuesRes.rows };
};

// Добавить параметр. Возвращает { existed, param } — при дубле отдаём существующий.
const createParam = async ({ name, createdBy }) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { existed: false, param: null };

    const existing = await pool.query(
        `SELECT id, name, created_by, created_at
         FROM call_object_params
         WHERE lower(name) = lower($1)
         LIMIT 1`,
        [trimmed]
    );
    if (existing.rows.length > 0) return { existed: true, param: existing.rows[0] };

    const res = await pool.query(
        `INSERT INTO call_object_params (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, created_by, created_at`,
        [trimmed, createdBy]
    );
    return { existed: false, param: res.rows[0] };
};

// Удалить параметр вместе с его значениями. Идемпотентно.
const deleteParam = async (id) => {
    const row = await pool.query(
        `SELECT name FROM call_object_params WHERE id = $1`,
        [id]
    );
    if (!row.rows.length) return { ok: true };

    const name = row.rows[0].name;
    await pool.query(
        `DELETE FROM call_object_param_values WHERE lower(param_name) = lower($1)`,
        [name]
    );
    await pool.query(`DELETE FROM call_object_params WHERE id = $1`, [id]);
    return { ok: true };
};

// Добавить значение для параметра. Возвращает { existed, value }.
const createValue = async ({ paramName, value, createdBy }) => {
    const pName = String(paramName || '').trim();
    const val = String(value || '').trim();
    if (!pName || !val) return { existed: false, value: null };

    const existing = await pool.query(
        `SELECT id, param_name, value, created_by, created_at
         FROM call_object_param_values
         WHERE lower(param_name) = lower($1) AND lower(value) = lower($2)
         LIMIT 1`,
        [pName, val]
    );
    if (existing.rows.length > 0) return { existed: true, value: existing.rows[0] };

    const res = await pool.query(
        `INSERT INTO call_object_param_values (param_name, value, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, param_name, value, created_by, created_at`,
        [pName, val, createdBy]
    );
    return { existed: false, value: res.rows[0] };
};

// Удалить значение. Идемпотентно.
const deleteValue = async (id) => {
    await pool.query(`DELETE FROM call_object_param_values WHERE id = $1`, [id]);
    return { ok: true };
};

module.exports = {
    listCatalog,
    createParam,
    deleteParam,
    createValue,
    deleteValue,
};
