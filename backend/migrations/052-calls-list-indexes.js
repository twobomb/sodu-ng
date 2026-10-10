/* eslint-disable no-undef */
// ============================================================
// Индексы под список вызовов.
//
//  • calls(created_at DESC) — список сортируется «ORDER BY created_at DESC»
//    без фильтров; без индекса Postgres каждый раз сортирует всю таблицу
//    (на десятках тысяч строк это самые дорогие запросы списка).
//  • calls(message_received_at) — диапазонный фильтр по времени получения
//    сообщения (received_from / received_to).
//
// Оба индекса создаются идемпотентно (IF NOT EXISTS).
// ============================================================

exports.up = (pgm) => {
    pgm.sql(
        'CREATE INDEX IF NOT EXISTS calls_created_at_idx ON calls (created_at DESC);'
    );
    pgm.sql(
        'CREATE INDEX IF NOT EXISTS calls_message_received_at_idx ON calls (message_received_at);'
    );
};

exports.down = (pgm) => {
    pgm.sql('DROP INDEX IF EXISTS calls_created_at_idx;');
    pgm.sql('DROP INDEX IF EXISTS calls_message_received_at_idx;');
};
