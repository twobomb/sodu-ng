/* eslint-disable no-undef */
// ============================================================
// Типы техники: флаг "Отображать тип в строевой записке"
//  - unit_types.show_in_line_note (boolean, по умолчанию true)
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('unit_types', {
        show_in_line_note: {
            type: 'boolean',
            notNull: true,
            default: true,
            comment: 'Отображать тип техники в строевой записке',
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('unit_types', ['show_in_line_note']);
};