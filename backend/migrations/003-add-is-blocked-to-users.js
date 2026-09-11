exports.up = (pgm) => {
    pgm.addColumn('users', {
        is_blocked: { type: 'boolean', notNull: true, default: false },
    });
    pgm.createIndex('users', 'is_blocked');
};

exports.down = (pgm) => {
    pgm.dropIndex('users', ['is_blocked']);
    pgm.dropColumn('users', 'is_blocked');
};