/* eslint-disable no-undef */
// ============================================================
// Полное пересоздание таблицы типовых фраз хода событий.
//
// Удаляет существующую таблицу call_event_templates (вместе со
// «загрязнёнными» данным: дубли, личные пробные записи) и создаёт
// её заново, наполняя только предустановленными общими фразами.
//
// Фразы бывают двух типов:
//   - global  — видят все пользователи (добавлять/удалять может только
//               тот, у кого есть право calls.manage_event_templates);
//   - personal — видит и может удалять только создатель (created_by).
// ============================================================

exports.up = (pgm) => {
    // 1. Полностью сбрасываем таблицу
    pgm.dropTable('call_event_templates');

    // 2. Создаём заново
    pgm.createTable('call_event_templates', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        text: { type: 'text', notNull: true },
        scope: {
            type: 'text',
            notNull: true,
            default: 'personal',
        },
        created_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'CASCADE',
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });

    // 3. Ограничение допустимых значений scope
    pgm.addConstraint('call_event_templates', 'call_event_templates_scope_check', {
        check: "scope IN ('personal', 'global')",
    });

    // 4. Индекс для выборки «общие + личные» конкретного пользователя
    pgm.createIndex('call_event_templates', ['scope', 'created_by', 'created_at']);

    // 5. Предустановленные общие фразы
    pgm.sql(`
        INSERT INTO call_event_templates (text, scope) VALUES
        ('локализация пожара', 'global'),
        ('угроза атаки БПЛА, л/с в укрытии', 'global'),
        ('отбой угрозе БПЛА', 'global');
    `);

    // 6. Право на управление общими фразами — ролям admin и dispatcher
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["calls.manage_event_templates"]'::jsonb
        WHERE code IN ('admin', 'dispatcher')
          AND NOT (permissions ? 'calls.manage_event_templates');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p <> 'calls.manage_event_templates'
        ), '[]'::jsonb)
        WHERE permissions @> '["calls.manage_event_templates"]'::jsonb;
    `);
    pgm.dropTable('call_event_templates');
};