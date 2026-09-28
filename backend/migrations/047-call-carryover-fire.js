/* eslint-disable no-undef */
// ============================================================
// Переходящий пожар
// Новая колонка calls:
//   - carryover_fire (boolean, default false) — галочка «Переходящий пожар»
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        carryover_fire: { type: 'boolean', default: false, notNull: true },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', ['carryover_fire']);
};