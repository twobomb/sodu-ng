/* eslint-disable no-undef */
exports.up = async (pgm) => {
    // Включаем расширение для генерации UUID (если ещё не включено)
    pgm.createExtension('uuid-ossp', { ifNotExists: true });

    // Таблица users
    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        username: { type: 'text', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        role: {
            type: 'text',
            notNull: true,
            check: "role IN ('developer', 'admin', 'dispatcher', 'viewer')",
        },
        can_view_all: { type: 'boolean', default: false, notNull: true },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // Таблица departments
    pgm.createTable('departments', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'text', notNull: true },
        parent_id: { type: 'uuid', references: 'departments(id)', onDelete: 'SET NULL' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // Таблица user_departments (многие ко многим)
    pgm.createTable('user_departments', {
        user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
        department_id: { type: 'uuid', notNull: true, references: 'departments(id)', onDelete: 'CASCADE' },
    });
    pgm.addConstraint('user_departments', 'user_departments_pkey', {
        primaryKey: ['user_id', 'department_id'],
    });

    // Таблица fires
    pgm.createTable('fires', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        title: { type: 'text', notNull: true },
        description: { type: 'text' },
        address: { type: 'text' },
        lat: { type: 'numeric' },
        lng: { type: 'numeric' },
        status: {
            type: 'text',
            notNull: true,
            check: "status IN ('active', 'resolved', 'closed')",
        },
        department_id: { type: 'uuid', references: 'departments(id)', onDelete: 'SET NULL' },
        created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // Таблица units
    pgm.createTable('units', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'text', notNull: true },
        type: { type: 'text', notNull: true },
        plate_number: { type: 'text' },
        status: {
            type: 'text',
            notNull: true,
            check: "status IN ('available', 'dispatched', 'repair', 'unavailable')",
        },
        department_id: { type: 'uuid', references: 'departments(id)', onDelete: 'SET NULL' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // Таблица sessions (для отслеживания активных сессий)
    pgm.createTable('sessions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
        token: { type: 'text', notNull: true }, // будем хранить JWT или его jti
        last_active_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });
    pgm.createIndex('sessions', 'user_id');
    pgm.createIndex('sessions', 'token');
};

exports.down = async (pgm) => {
    // Удаляем таблицы в обратном порядке (с учётом зависимостей)
    pgm.dropTable('sessions');
    pgm.dropTable('units');
    pgm.dropTable('fires');
    pgm.dropTable('user_departments');
    pgm.dropTable('departments');
    pgm.dropTable('users');
    // Расширение не удаляем, оно может использоваться другими БД
};