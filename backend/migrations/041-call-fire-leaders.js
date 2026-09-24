/* eslint-disable no-undef */
// ============================================================
// Руководители тушения пожара (РТП)
// Новая колонка calls:
//   - fire_leaders  (jsonb) — список РТП: [{fio, position}]
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        fire_leaders: { type: 'jsonb' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', ['fire_leaders']);
};