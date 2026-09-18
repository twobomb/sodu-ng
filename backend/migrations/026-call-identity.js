/* eslint-disable no-undef */
// ============================================================
// Идентичность вызова: number (последовательность), call_code (словесный id), color
// ============================================================
exports.up = (pgm) => {
    // 1) Новые колонки
    pgm.addColumns('calls', {
        number: { type: 'bigint' },
        call_code: { type: 'text' },
        color: { type: 'text' },
    });

    // 2) Проставляем number существующим записям (по дате создания)
    pgm.sql(`
        WITH numbered AS (
            SELECT id, row_number() OVER (ORDER BY created_at, id)::bigint AS rn
            FROM calls
        )
        UPDATE calls c
        SET number = n.rn
        FROM numbered n
        WHERE c.id = n.id;
    `);

    // 3) NOT NULL, уникальность, автопоследовательность для новых вызовов
    pgm.sql('ALTER TABLE calls ALTER COLUMN number SET NOT NULL;');
    pgm.addConstraint('calls', 'calls_number_uniq', { unique: ['number'] });
    pgm.createSequence('calls_number_seq');
    pgm.sql(`
        SELECT setval('calls_number_seq', COALESCE((SELECT MAX(number) FROM calls), 0) + 1, false);
    `);
    pgm.sql(`ALTER TABLE calls ALTER COLUMN number SET DEFAULT nextval('calls_number_seq');`);
};

exports.down = (pgm) => {
    pgm.sql('ALTER TABLE calls ALTER COLUMN number DROP DEFAULT;');
    pgm.dropSequence('calls_number_seq');
    pgm.dropConstraint('calls', 'calls_number_uniq');
    pgm.dropColumns('calls', ['number', 'call_code', 'color']);
};