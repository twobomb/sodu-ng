/* eslint-disable no-undef */
// ============================================================
// ИНВЕРСИЯ СВЯЗИ ОКРУГ-ПОДРАЗДЕЛЕНИЕ
// Раньше: у округа было department_id (несколько округов у подразделения).
// Теперь: округ — самостоятельный справочник, а у подразделения
// выбирается один округ (departments.municipality_id).
// ============================================================
exports.up = (pgm) => {
    // Округ больше не привязан к подразделению
    pgm.dropIndex('municipalities', 'department_id');
    pgm.dropColumns('municipalities', ['department_id']);

    // У подразделения — один округ
    pgm.addColumns('departments', {
        municipality_id: {
            type: 'uuid',
            references: 'municipalities(id)',
            onDelete: 'SET NULL',
        },
    });
    pgm.createIndex('departments', 'municipality_id');
};

exports.down = (pgm) => {
    pgm.dropIndex('departments', 'municipality_id');
    pgm.dropColumns('departments', ['municipality_id']);
    pgm.addColumns('municipalities', {
        department_id: {
            type: 'uuid',
            references: 'departments(id)',
            onDelete: 'CASCADE',
        },
    });
    pgm.createIndex('municipalities', 'department_id');
};
