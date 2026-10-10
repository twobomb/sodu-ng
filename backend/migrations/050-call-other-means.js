/* eslint-disable no-undef */
// ============================================================
// Привлечённые технические средства других ведомств.
//
// Новый блок карточки вызова: произвольные наименования (например
// «Скорая помощь») с указанием количества. Хранится в calls как
// jsonb-массив записей { uid, name, count }.
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        involved_other_means: {
            type: 'jsonb',
            notNull: true,
            default: pgm.func("'[]'::jsonb"),
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', ['involved_other_means']);
};
