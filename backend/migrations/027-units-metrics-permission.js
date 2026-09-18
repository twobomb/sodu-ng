/* eslint-disable no-undef */
// ============================================================
// Новое право «Редактирование показателей» для техники.
// Выдаём его ролям, у которых уже есть units.update (admin, dispatcher и т.п.)
// ============================================================
exports.up = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["units.update_metrics"]'::jsonb
        WHERE permissions @> '["units.update"]'::jsonb
          AND NOT (permissions ? 'units.update_metrics');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE(
            (
                SELECT jsonb_agg(p)
                FROM jsonb_array_elements_text(permissions) p
                WHERE p <> 'units.update_metrics'
            ),
            '[]'::jsonb
        )
        WHERE permissions ? 'units.update_metrics';
    `);
};