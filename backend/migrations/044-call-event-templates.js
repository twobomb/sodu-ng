/**
 * Типовые фразы для «Хода событий» в карточке вызова.
 * Фразы бывают двух типов:
 *  - global  — видят все пользователи (добавлять/удалять может только тот, у кого
 *              есть право calls.manage_event_templates);
 *  - personal — видит и может удалять только создатель (created_by).
 * Предустановленные общие фразы создаются с created_by = NULL.
 */
exports.up = (pgm) => {
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

    // Ограничение допустимых значений scope
    pgm.addConstraint('call_event_templates', 'call_event_templates_scope_check', {
        check: "scope IN ('personal', 'global')",
    });

    // Индекс для выборки «общие + личные» конкретного пользователя
    pgm.createIndex('call_event_templates', ['scope', 'created_by', 'created_at']);

    // Предустановленные общие фразы
    pgm.sql(`
        INSERT INTO call_event_templates (text, scope) VALUES
        ('локализация пожара', 'global'),
        ('угроза атаки БПЛА, л/с в укрытии', 'global'),
        ('отбой угрозе БПЛА', 'global');
    `);

    // Право на управление общими фразами — ролям admin и dispatcher
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