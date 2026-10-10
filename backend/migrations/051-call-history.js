/* eslint-disable no-undef */
// ============================================================
// История редактирования карточки вызова.
//
// call_history — журнал действий по вызову: кто, когда и что сделал.
//   • username продублирован в записи, чтобы история читалась даже
//     после переименования или удаления пользователя;
//   • action — тип действия (created/updated/status/units/events/access);
//   • note — короткое примечание («Удалена единица техники» и т. п.).
//
// Для уже существующих вызовов добавляется первая запись «создана»
// на основании calls.created_at и calls.created_by.
// ============================================================

exports.up = (pgm) => {
    pgm.createTable('call_history', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        call_id: {
            type: 'uuid',
            notNull: true,
            references: 'calls(id)',
            onDelete: 'CASCADE',
        },
        user_id: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
        username: { type: 'text' },
        action: { type: 'text', notNull: true },
        note: { type: 'text' },
        created_at: {
            type: 'timestamp with time zone',
            notNull: true,
            default: pgm.func('now()'),
        },
    });

    pgm.createIndex('call_history', ['call_id', 'created_at']);

    // Первая запись истории для ранее созданных вызовов
    pgm.sql(`
        INSERT INTO call_history (call_id, user_id, username, action, note, created_at)
        SELECT c.id, c.created_by, u.username, 'created', 'Карточка вызова создана', c.created_at
        FROM calls c
        LEFT JOIN users u ON u.id = c.created_by;
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('call_history');
};
