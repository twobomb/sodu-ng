exports.up = (pgm) => {
    pgm.addColumn('departments', {
        sort_order: { type: 'integer', notNull: true, default: 0 },
    });
    pgm.createIndex('departments', ['parent_id', 'sort_order']);
};

exports.down = (pgm) => {
    pgm.dropIndex('departments', ['parent_id', 'sort_order']);
    pgm.dropColumn('departments', 'sort_order');
};