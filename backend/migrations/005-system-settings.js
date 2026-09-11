exports.up = (pgm) => {
    pgm.createTable('system_settings', {
        key: { type: 'text', primaryKey: true },
        value: { type: 'jsonb', notNull: true },
        updated_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
        updated_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
    });

    pgm.sql(
        `INSERT INTO system_settings (key, value) VALUES ('maintenance_mode', 'false'::jsonb);`
    );
};

exports.down = (pgm) => {
    pgm.dropTable('system_settings');
};