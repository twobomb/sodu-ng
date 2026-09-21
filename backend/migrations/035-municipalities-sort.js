/* eslint-disable no-undef */
// ============================================================
// СОРТИРОВКА ОКРУГОВ
// Добавляем sort_order для порядка округов,
// который меняется перетаскиванием на странице.
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('municipalities', {
        sort_order: { type: 'integer', notNull: true, default: 0 },
    });
    // Существующим округам порядок по алфавиту
    pgm.sql(`
        WITH ranked AS (
            SELECT id, row_number() OVER (ORDER BY name) - 1 AS rn
            FROM municipalities
        )
        UPDATE municipalities m
        SET sort_order = ranked.rn
        FROM ranked
        WHERE m.id = ranked.id;
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('municipalities', ['sort_order']);
};