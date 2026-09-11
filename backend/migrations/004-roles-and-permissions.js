const { ALL_PERMISSION_KEYS } = require('../src/config/permissions');

exports.up = (pgm) => {
    // Таблица ролей
    pgm.createTable('roles', {
        code: { type: 'text', primaryKey: true },
        name: { type: 'text', notNull: true },
        description: { type: 'text' },
        permissions: { type: 'jsonb', notNull: true, default: '[]' },
        is_system: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // Дефолтные роли
    const defaultPermissions = {
        admin: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('roles.delete')),
        dispatcher: [
            'fires.view', 'fires.create', 'fires.update',
            'units.view', 'units.update',
            'departments.view',
        ],
        viewer: ['fires.view', 'units.view', 'departments.view'],
        developer: [], // игнорирует всё
    };

    pgm.sql(`
    INSERT INTO roles (code, name, description, permissions, is_system) VALUES
    ('developer', 'Разработчик', 'Полный доступ, игнорирует все правила. Назначается только через БД.', '${JSON.stringify(defaultPermissions.developer)}'::jsonb, true),
    ('admin', 'Администратор', 'Управление системой и пользователями', '${JSON.stringify(defaultPermissions.admin)}'::jsonb, true),
    ('dispatcher', 'Диспетчер', 'Работа с пожарами и техникой', '${JSON.stringify(defaultPermissions.dispatcher)}'::jsonb, true),
    ('viewer', 'Наблюдатель', 'Только просмотр', '${JSON.stringify(defaultPermissions.viewer)}'::jsonb, true);
  `);

    // FK на users.role
    pgm.addConstraint('users', 'users_role_fkey', {
        foreignKeys: {
            columns: 'role',
            references: 'roles(code)',
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
    });
};

exports.down = (pgm) => {
    pgm.dropConstraint('users', 'users_role_fkey');
    pgm.dropTable('roles');
};