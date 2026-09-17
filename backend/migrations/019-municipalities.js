/* eslint-disable no-undef */
// ============================================================
// ОКРУГА (муниципалитеты)
// Округ привязывается к подразделению.
// У вызова появляются department_id и municipality_id.
// ============================================================
exports.up = (pgm) => {
    // Справочник округов, привязанных к подразделению
    pgm.createTable('municipalities', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
        department_id: {
            type: 'uuid',
            notNull: true,
            references: 'departments(id)',
            onDelete: 'CASCADE',
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
    pgm.createIndex('municipalities', 'department_id');

    // У вызова — подразделение и округ
    pgm.addColumns('calls', {
        department_id: {
            type: 'uuid',
            references: 'departments(id)',
            onDelete: 'SET NULL',
        },
        municipality_id: {
            type: 'uuid',
            references: 'municipalities(id)',
            onDelete: 'SET NULL',
        },
    });
    pgm.createIndex('calls', 'department_id');
    pgm.createIndex('calls', 'municipality_id');
};

exports.down = (pgm) => {
    pgm.dropIndex('calls', 'municipality_id');
    pgm.dropIndex('calls', 'department_id');
    pgm.dropColumns('calls', ['department_id', 'municipality_id']);
    pgm.dropTable('municipalities');
};
