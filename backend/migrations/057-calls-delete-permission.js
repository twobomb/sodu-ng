/* eslint-disable no-undef */
// ============================================================
// Право на удаление вызовов (calls.delete).
// Выдаём ролям admin и dispatcher; остальным — через «Роли и права».
// ============================================================

exports.up = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["calls.delete"]'::jsonb
        WHERE code IN ('admin')
          AND NOT (permissions ? 'calls.delete');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p <> 'calls.delete'
        ), '[]'::jsonb)
        WHERE permissions ? 'calls.delete';
    `);
};
