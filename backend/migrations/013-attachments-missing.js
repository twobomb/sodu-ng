exports.up = (pgm) => {
    pgm.addColumn('attachments', {
        is_missing: { type: 'boolean', notNull: true, default: false },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('attachments', 'is_missing');
};