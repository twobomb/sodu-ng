/* eslint-disable no-undef */
// ============================================================
// Блок «Объекты» карточки вызова + справочники параметров/значений.
//
// 1. calls.objects (jsonb) — список объектов карточки:
//      [{ items: [{ param, value }] }],
//      где param — произвольный параметр объекта (например «размер»),
//      value — его значение (например «10x20»).
//    Нумерация объектов («Объект 1», «Объект 2», …) определяется
//    порядком элементов и не хранится отдельно.
//
// 2. call_object_params — справочник параметров (глобальный):
//      пользователи с правом calls.manage_object_params добавляют/
//      удаляют параметры; уникальность — без учёта регистра.
//
// 3. call_object_param_values — справочник значений, привязанных к
//      параметру (по имени параметра): уникальность пары
//      (параметр, значение) без учёта регистра.
// ============================================================

exports.up = (pgm) => {
    // 1. Колонка карточки вызова
    pgm.addColumns('calls', {
        objects: {
            type: 'jsonb',
            notNull: true,
            default: pgm.func("'[]'::jsonb"),
        },
    });

    // 2. Справочник параметров объектов
    pgm.createTable('call_object_params', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
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
    });
    // Уникальность параметров без учёта регистра
    pgm.sql(`
        CREATE UNIQUE INDEX call_object_params_name_lower_unique
        ON call_object_params (lower(name));
    `);

    // 3. Справочник значений параметров (привязаны к имени параметра)
    pgm.createTable('call_object_param_values', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        param_name: { type: 'text', notNull: true },
        value: { type: 'text', notNull: true },
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
    });
    // Уникальность пары (параметр, значение) без учёта регистра
    pgm.sql(`
        CREATE UNIQUE INDEX call_object_param_values_lower_unique
        ON call_object_param_values (lower(param_name), lower(value));
    `);

    // 4. Право на управление справочником параметров — ролям admin и dispatcher
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["calls.manage_object_params"]'::jsonb
        WHERE code IN ('admin', 'dispatcher')
          AND NOT (permissions ? 'calls.manage_object_params');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p <> 'calls.manage_object_params'
        ), '[]'::jsonb)
        WHERE permissions @> '["calls.manage_object_params"]'::jsonb;
    `);
    pgm.dropTable('call_object_param_values');
    pgm.dropTable('call_object_params');
    pgm.dropColumns('calls', ['objects']);
};
