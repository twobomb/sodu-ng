/* eslint-disable no-undef */
// ============================================================
// История статусов техники: храним связь с вызовом
// (чтобы в хронологии показывать идентификатор и цвет вызова)
// ============================================================
exports.up = (pgm) => {
    pgm.addColumns('unit_status_history', {
        call_id: { type: 'uuid', references: 'calls(id)', onDelete: 'SET NULL' },
        call_code: { type: 'text' },
        call_color: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('unit_status_history', ['call_id', 'call_code', 'call_color']);
};