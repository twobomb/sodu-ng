exports.up = (pgm) => {
    pgm.addColumn('attachments', {
        is_public: { type: 'boolean', notNull: true, default: false },
    });
    pgm.createIndex('attachments', 'is_public');
};

exports.down = (pgm) => {
    pgm.dropIndex('attachments', 'is_public');
    pgm.dropColumn('attachments', 'is_public');
};