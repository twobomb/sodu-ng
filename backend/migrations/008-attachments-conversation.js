exports.up = (pgm) => {
    // message_id теперь nullable — attachments могут существовать до привязки
    pgm.alterColumn('attachments', 'message_id', { notNull: false });

    // conversation_id — обязателен
    pgm.addColumn('attachments', {
        conversation_id: {
            type: 'uuid',
            references: 'conversations(id)',
            onDelete: 'CASCADE',
        },
    });

    // Заполняем для существующих записей (если есть)
    pgm.sql(`
    UPDATE attachments a
    SET conversation_id = m.conversation_id
    FROM messages m
    WHERE a.message_id = m.id AND a.conversation_id IS NULL
  `);

    pgm.alterColumn('attachments', 'conversation_id', { notNull: true });

    pgm.createIndex('attachments', 'conversation_id');
    // Индекс на "сиротские" attachments (для очистки)
    pgm.createIndex('attachments', ['created_at'], {
        where: 'message_id IS NULL',
        name: 'attachments_orphans_idx',
    });
};

exports.down = (pgm) => {
    pgm.dropIndex('attachments', ['created_at'], {
        name: 'attachments_orphans_idx',
    });
    pgm.dropIndex('attachments', 'conversation_id');
    pgm.dropColumn('attachments', 'conversation_id');
    pgm.alterColumn('attachments', 'message_id', { notNull: true });
};