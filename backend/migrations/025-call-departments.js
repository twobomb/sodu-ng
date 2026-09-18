/* eslint-disable no-undef */
// ============================================================
// Подразделения, привязанные к вызову (видимость и доступ к карточке)
// ============================================================
exports.up = (pgm) => {
    pgm.createTable('call_departments', {
        call_id: { type: 'uuid', notNull: true, references: 'calls(id)', onDelete: 'CASCADE' },
        department_id: { type: 'uuid', notNull: true, references: 'departments(id)', onDelete: 'CASCADE' },
    });
    pgm.addConstraint('call_departments', 'call_departments_pkey', {
        primaryKey: ['call_id', 'department_id'],
    });
    pgm.createIndex('call_departments', 'call_id');
    pgm.createIndex('call_departments', 'department_id');

    // Существующим вызовам привязываем их подразделение (если оно указано),
    // чтобы они не пропали из списка у соответствующих пользователей
    pgm.sql(`
        INSERT INTO call_departments (call_id, department_id)
        SELECT id, department_id FROM calls WHERE department_id IS NOT NULL
        ON CONFLICT DO NOTHING
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('call_departments');
};