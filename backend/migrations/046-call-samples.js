/* eslint-disable no-undef */
// ============================================================
// Сохранённые выборки вызовов (конструктор запросов)
// Таблица: call_samples
//   - name       — название выборки (уникально без учёта регистра)
//   - definition — определение запроса (jsonb): { items: [...] }
//   - created_by — автор
// ============================================================

exports.up = (pgm) => {
    pgm.createTable('call_samples', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
        definition: { type: 'jsonb', notNull: true },
        created_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
        updated_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });

    // Названия выборок уникальны без учёта регистра (пересохранение по имени)
    pgm.sql(`
        CREATE UNIQUE INDEX call_samples_name_lower_unique
        ON call_samples (lower(name));
    `);
    pgm.createIndex('call_samples', 'created_at');

    // Права ролям: просмотр раздела и управление сохранёнными выборками
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["call_samples.view","call_samples.manage"]'::jsonb
        WHERE code IN ('admin', 'dispatcher')
          AND NOT (permissions ? 'call_samples.view');
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('call_samples');

    pgm.sql(`
        UPDATE roles SET permissions = (
          SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
          WHERE p NOT LIKE 'call_samples.%'
        ) WHERE permissions ? 'call_samples.view';
    `);
};
