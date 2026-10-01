/* eslint-disable no-undef */
// ============================================================
// Поле «Объект» + признак «Ложный вызов» и справочник объектов.
//
// 1. calls.object_name — значение поля «Объект» (выбор из справочника или
//                        произвольный текст, введённый пользователем);
// 2. calls.false_call  — признак «Ложный вызов» (переключатель в карточке);
// 3. call_object_templates — справочник значений поля «Объект»:
//      • global   — видят все пользователи (добавлять/удалять может только
//                   тот, у кого есть право calls.manage_object_templates);
//      • personal — видит и может удалять только создатель (created_by).
// ============================================================

exports.up = (pgm) => {
    // 1. Новые колонки карточки вызова
    pgm.addColumns('calls', {
        object_name: { type: 'text' },
        false_call: { type: 'boolean', notNull: true, default: false },
    });

    // 2. Справочник значений поля «Объект»
    pgm.createTable('call_object_templates', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
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
    pgm.addConstraint('call_object_templates', 'call_object_templates_scope_check', {
        check: "scope IN ('personal', 'global')",
    });

    // 4. Индекс для выборки «общие + личные» конкретного пользователя
    pgm.createIndex('call_object_templates', ['scope', 'created_by', 'created_at']);

    // 5. Предустановленные общие значения
    pgm.sql(`
        INSERT INTO call_object_templates (name, scope) VALUES
        ('загорание с/ травы', 'global'),
        ('загорание мусора', 'global'),
        ('загорание ж/дома', 'global'),
        ('загорание неж/дома', 'global'),
        ('загорание а/м', 'global');
    `);

    // 6. Право на управление общими значениями — ролям admin и dispatcher
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["calls.manage_object_templates"]'::jsonb
        WHERE code IN ('admin', 'dispatcher')
          AND NOT (permissions ? 'calls.manage_object_templates');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p <> 'calls.manage_object_templates'
        ), '[]'::jsonb)
        WHERE permissions @> '["calls.manage_object_templates"]'::jsonb;
    `);
    pgm.dropTable('call_object_templates');
    pgm.dropColumns('calls', ['object_name', 'false_call']);
};
