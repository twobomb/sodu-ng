/* eslint-disable no-undef */
// ============================================================
// Порядок сортировки техники внутри подразделения
// (перетаскивание в списке техники)
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('units', {
        sort_order: { type: 'integer', notNull: true, default: 0 },
    });
    // Существующей технике порядок по дате создания внутри подразделения
    pgm.sql(`
        WITH ranked AS (
            SELECT id, row_number() OVER (
                PARTITION BY department_id ORDER BY created_at, id
            ) - 1 AS rn
            FROM units
        )
        UPDATE units u
        SET sort_order = r.rn
        FROM ranked r
        WHERE u.id = r.id;
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('units', ['sort_order']);
};