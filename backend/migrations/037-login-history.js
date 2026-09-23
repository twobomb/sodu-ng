/* eslint-disable no-undef */
// ============================================================
// История входов пользователей
//  - таблица login_history: при каждом успешном входе сохраняются
//    время, пользователь и IP-адрес
//  - выдача права users.login_history роли admin
// ============================================================
exports.up = (pgm) => {
    pgm.createExtension('uuid-ossp', { ifNotExists: true });

    pgm.createTable('login_history', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE',
        },
        // Снимок имени на момент входа — сохранится даже после удаления/переименования
        username: { type: 'text', notNull: true },
        ip: { type: 'text' },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });

    pgm.createIndex('login_history', 'user_id');
    pgm.createIndex('login_history', 'created_at');

    // Выдача прав на просмотр истории входов роли admin
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["users.login_history"]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'users.login_history');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p <> 'users.login_history'
    )
    WHERE permissions @> '["users.login_history"]'::jsonb;
  `);
    pgm.dropTable('login_history');
};