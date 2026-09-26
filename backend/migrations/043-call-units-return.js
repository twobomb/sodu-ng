/* eslint-disable no-undef */
// ============================================================
// Время возвращения техники с вызова
// Новая колонка call_units:
//   - return_at (timestamptz) — время возвращения техники
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('call_units', {
        return_at: { type: 'timestamp with time zone' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('call_units', ['return_at']);
};