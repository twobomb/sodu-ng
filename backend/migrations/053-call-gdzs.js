/* eslint-disable no-undef */
// ============================================================
// ГДЗС (газодымозащитная служба)
//
// Новый блок карточки вызова:
//   - gdzs_used  (boolean) — флажок «Использование ГДЗС»;
//   - gdzs_units (jsonb)   — список звеньев ГДЗС:
//       [{ people, minutes }], где people — количество человек в звене,
//       minutes — время работы звена в минутах.
//
// Нумерация звеньев («Звено 1», «Звено 2», …) определяется порядком
// элементов массива и не хранится отдельно.
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        gdzs_used: {
            type: 'boolean',
            notNull: true,
            default: false,
        },
        gdzs_units: {
            type: 'jsonb',
            notNull: true,
            default: pgm.func("'[]'::jsonb"),
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', ['gdzs_used', 'gdzs_units']);
};
