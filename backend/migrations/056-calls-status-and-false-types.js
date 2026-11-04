/* eslint-disable no-undef */
// ============================================================
// Статусы вызова + «ложные» типы вызова.
//
// 1. Признак «Ложный вызов» (false_call) заменяется типами вызова:
//    «Ложное сообщение» и «Ложное срабатывание АПС». Существующие
//    ложные вызовы переводим в тип «Ложное сообщение».
//    Колонка calls.false_call удаляется.
// 2. Признак «Переходящий пожар» (carryover_fire) убирается — колонка
//    calls.carryover_fire удаляется.
// 3. Статусы вызова:
//      было:  processing, closed, error
//      стало: processing («Открытый»), closed («Закрыт»),
//             report_preparation («Подготовка отчёта»).
//    Статус «Ошибочный» (error) удаляется вместе с такими вызовами —
//    он был аналогом удаления и нигде не учитывался.
//
// ВНИМАНИЕ: перенос данных необратим (down не восстанавливает значения
// carryover_fire/false_call и удалённые «ошибочные» вызовы).
// ============================================================

exports.up = (pgm) => {
    // 1. Ложные вызовы → тип «Ложное сообщение»
    pgm.sql(`
        UPDATE calls
        SET type = 'Ложное сообщение', updated_at = NOW()
        WHERE false_call = true
          AND (type IS NULL OR type NOT IN ('Ложное сообщение', 'Ложное срабатывание АПС'));
    `);

    // 2. Удаляем «ошибочные» вызовы (аналог удаления)
    pgm.sql(`DELETE FROM calls WHERE status = 'error';`);

    // 3. Новый набор допустимых статусов
    pgm.dropConstraint('calls', 'calls_status_check', { ifExists: true });
    pgm.addConstraint('calls', 'calls_status_check', {
        check: "status IN ('processing', 'closed', 'report_preparation')",
    });

    // 4. Убираем неиспользуемые признаки
    pgm.dropColumns('calls', ['carryover_fire', 'false_call']);
};

exports.down = (pgm) => {
    pgm.addColumns('calls', {
        carryover_fire: { type: 'boolean', notNull: true, default: false },
        false_call: { type: 'boolean', notNull: true, default: false },
    });

    pgm.dropConstraint('calls', 'calls_status_check', { ifExists: true });
    pgm.addConstraint('calls', 'calls_status_check', {
        check: "status IN ('processing', 'closed', 'error')",
    });
};
