/* eslint-disable no-undef */
// ============================================================
// ГАРНИЗОНЫ
// Самостоятельный справочник, аналогичный «Округам».
// Каждое подразделение привязывается к одному гарнизону
// (departments.garrison_id). Порядок задаётся полем sort_order
// и меняется перетаскиванием на странице.
// ============================================================
exports.up = (pgm) => {
    pgm.createTable('garrisons', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },
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

    // У подразделения — один гарнизон
    pgm.addColumns('departments', {
        garrison_id: {
            type: 'uuid',
            references: 'garrisons(id)',
            onDelete: 'SET NULL',
        },
    });
    pgm.createIndex('departments', 'garrison_id');
};

exports.down = (pgm) => {
    pgm.dropIndex('departments', 'garrison_id');
    pgm.dropColumns('departments', ['garrison_id']);
    pgm.dropTable('garrisons');
};