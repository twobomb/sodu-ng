/* eslint-disable no-undef */
// ============================================================
// Подразделения: флаг «Отображать в строевой записке»
//  - departments.show_in_line_note (boolean, по умолчанию true)
// Если false — подразделение не показывается на странице
// «Строевая записка» и не попадает в выгрузку.
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('departments', {
        show_in_line_note: {
            type: 'boolean',
            notNull: true,
            default: true,
            comment: 'Отображать подразделение в строевой записке',
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('departments', ['show_in_line_note']);
};