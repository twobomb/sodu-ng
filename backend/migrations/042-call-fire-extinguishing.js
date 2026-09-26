/* eslint-disable no-undef */
// ============================================================
// Средства пожаротушения и подача первого ствола
// Новые колонки calls:
//   - first_barrel_at          (timestamptz) — время подачи 1-го ствола
//   - fire_extinguishing_means (jsonb) — средства пожаротушения:
//       [{uid, name, qty, text}], где qty — количество (для типов с кол-вом),
//       text — текстовое примечание (для «Иные»)
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        first_barrel_at: { type: 'timestamp with time zone' },
        fire_extinguishing_means: { type: 'jsonb' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', ['first_barrel_at', 'fire_extinguishing_means']);
};