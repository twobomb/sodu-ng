/* eslint-disable no-undef */
// ============================================================
// ВИДЫ ПОДРАЗДЕЛЕНИЙ
// Справочник видов подразделений. К каждому подразделению
// привязывается один вид (departments.department_type_id).
// Системные виды (ФПС/ППС/ВПО/ЧПО/МПО/ДПК/АСФ) нельзя удалять.
// ============================================================
exports.up = (pgm) => {
    pgm.createTable('department_types', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
        is_system: { type: 'boolean', notNull: true, default: false },
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

    // Системные виды по умолчанию (нельзя удалять)
    const SYS = ['ФПС', 'ППС', 'ВПО', 'ЧПО', 'МПО', 'ДПК', 'АСФ'];
    SYS.forEach((name, i) => {
        pgm.sql(
            `INSERT INTO department_types (name, is_system, sort_order)
             VALUES ('${name.replace(/'/g, "''")}', true, ${(i + 1) * 10})`
        );
    });

    // У подразделения — один вид подразделения
    pgm.addColumns('departments', {
        department_type_id: {
            type: 'uuid',
            references: 'department_types(id)',
            onDelete: 'SET NULL',
        },
    });
    pgm.createIndex('departments', 'department_type_id');
};

exports.down = (pgm) => {
    pgm.dropIndex('departments', 'department_type_id');
    pgm.dropColumns('departments', ['department_type_id']);
    pgm.dropTable('department_types');
};