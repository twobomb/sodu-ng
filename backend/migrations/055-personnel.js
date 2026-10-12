/* eslint-disable no-undef */
// ============================================================
// Личный состав (модуль «л/с»).
//
// Таблица personnel:
//   id            — uuid;
//   department_id — обязательно (человек принадлежит подразделению);
//   full_name     — ФИО;
//   position      — должность;
//   rank_name     — звание;
//   phone         — номер телефона;
//   note          — примечание;
//   unit_id       — привязка к одной единице техники ТОГО ЖЕ подразделения
//                   (может быть пустой); при удалении техники — NULL;
//   sort_order    — порядок внутри подразделения (перетаскивание);
//   created_at / updated_at.
// ============================================================

exports.up = (pgm) => {
    pgm.createTable('personnel', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        department_id: {
            type: 'uuid',
            notNull: true,
            references: 'departments(id)',
            onDelete: 'CASCADE',
        },
        full_name: { type: 'text', notNull: true },
        position: { type: 'text' },
        rank_name: { type: 'text' },
        phone: { type: 'text' },
        note: { type: 'text' },
        unit_id: {
            type: 'uuid',
            references: 'units(id)',
            onDelete: 'SET NULL',
        },
        sort_order: { type: 'integer', notNull: true, default: 0 },
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

    // Порядок внутри подразделения и быстрый поиск привязанных к технике
    pgm.createIndex('personnel', ['department_id', 'sort_order']);
    pgm.createIndex('personnel', 'unit_id');

    // Права ролям: просмотр — admin/dispatcher/viewer
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["personnel.view"]'::jsonb
        WHERE code IN ('admin', 'dispatcher', 'viewer')
          AND NOT (permissions ? 'personnel.view');
    `);
    // Создание/редактирование/удаление — admin/dispatcher
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["personnel.create","personnel.update","personnel.delete"]'::jsonb
        WHERE code IN ('admin', 'dispatcher')
          AND NOT (permissions ? 'personnel.create');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p NOT LIKE 'personnel.%'
        ), '[]'::jsonb)
        WHERE permissions ? 'personnel.view' OR permissions ? 'personnel.create';
    `);
    pgm.dropTable('personnel');
};
