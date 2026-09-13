exports.up = (pgm) => {
    pgm.addColumns('departments', {
        full_name: { type: 'text' },
        address: { type: 'text' },
        phone: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('departments', ['full_name', 'address', 'phone']);
};