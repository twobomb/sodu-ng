exports.up = (pgm) => {
    pgm.addColumn('conversations', {
        allow_member_invites: { type: 'boolean', notNull: true, default: true },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('conversations', 'allow_member_invites');
};