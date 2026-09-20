/* eslint-disable no-undef */
// ============================================================
// Строевая записка
//  - таблица line_notes: одна запись на (подразделение, дату)
//    status: draft (черновик) | approved (утверждённая)
//    data:   (jsonb) техника + личный состав/средства защиты
//  - выдача прав line_notes.view / line_notes.manage ролям
//    admin и dispatcher
// ============================================================
exports.up = (pgm) => {
    pgm.createExtension('uuid-ossp', { ifNotExists: true });

    pgm.createTable('line_notes', {
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
        note_date: { type: 'date', notNull: true },
        status: {
            type: 'text',
            notNull: true,
            default: 'draft',
            check: "status IN ('draft', 'approved')",
        },
        data: {
            type: 'jsonb',
            notNull: true,
            default: pgm.func("'{}'::jsonb"),
        },
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

    // Уникальность: одно подразделение × одна дата
    pgm.addConstraint('line_notes', 'line_notes_department_date_unique', {
        unique: ['department_id', 'note_date'],
    });
    pgm.createIndex('line_notes', 'department_id');

    // Выдача прав строевой записки
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["line_notes.view","line_notes.manage"]'::jsonb
    WHERE code IN ('admin', 'dispatcher')
      AND NOT (permissions ? 'line_notes.view');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT IN ('line_notes.view', 'line_notes.manage')
    )
    WHERE permissions @> '["line_notes.view"]'::jsonb;
  `);
    pgm.dropTable('line_notes');
};