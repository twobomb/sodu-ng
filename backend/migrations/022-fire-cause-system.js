/* eslint-disable no-undef */
// ============================================================
// Системная причина пожара «Иные причины (указать причину)»
// Нельзя удалять/редактировать — она активирует поле «Укажите причину».
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('fire_causes', {
        is_system: { type: 'boolean', notNull: true, default: false },
    });

    // Восстанавливаем каноническое имя и помечаем системную причину
    pgm.sql(`
        UPDATE fire_causes
        SET name = 'Иные причины (указать причину)', is_system = true
        WHERE name ILIKE 'Иные причины%';
    `);

    // Если запись была удалена — добавляем заново
    pgm.sql(`
        INSERT INTO fire_causes (name, is_system, sort_order)
        SELECT 'Иные причины (указать причину)', true, 9999
        WHERE NOT EXISTS (SELECT 1 FROM fire_causes WHERE name ILIKE 'Иные причины%');
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('fire_causes', ['is_system']);
};