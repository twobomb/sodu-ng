/* eslint-disable no-undef */
// ============================================================
// Техника, этап 2
//  - unit_types.category  (Основная / Специальная / Вспомогательная / Пожарный поезд / Приспособленная и др.)
//  - units: call_id (привязка к вызову), топливо/пена/порошок/пробег (numeric)
//  - unit_metrics_history — история значений показателей
//  - call_units: dispatch_at, arrival_at (даты выезда/прибытия техники на вызов)
//  - unit_statuses.group_kind: 'dispatch' (выездные) / 'normal' (обычные)
// ============================================================
exports.up = (pgm) => {
    // ---- Категория типа техники ----
    pgm.addColumns('unit_types', {
        category: { type: 'text' }, // Основная | Специальная | Вспомогательная | Пожарный поезд | Приспособленная и другая
    });

    // ---- Поля техники + привязка к вызову ----
    pgm.addColumns('units', {
        call_id: { type: 'uuid', references: 'calls(id)', onDelete: 'SET NULL' },
        fuel_gasoline: { type: 'numeric' },   // Бензин, л
        fuel_diesel: { type: 'numeric' },     // Дизель, л
        foam_agent: { type: 'numeric' },      // Пенообразователь, л
        powder: { type: 'numeric' },          // Порошок, кг
        mileage: { type: 'numeric' },         // Пробег, км
    });
    pgm.createIndex('units', 'call_id');

    // ---- История показателей ----
    pgm.createTable('unit_metrics_history', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        unit_id: { type: 'uuid', notNull: true, references: 'units(id)', onDelete: 'CASCADE' },
        metric: { type: 'text', notNull: true }, // gasoline | diesel | foam | powder | mileage
        value: { type: 'numeric' },
        changed_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        changed_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    });
    pgm.createIndex('unit_metrics_history', ['unit_id', 'changed_at']);

    // ---- Дата выезда/прибытия техники на конкретный вызов ----
    pgm.addColumns('call_units', {
        dispatch_at: { type: 'timestamp with time zone' },
        arrival_at: { type: 'timestamp with time zone' },
    });

    // ---- Классификация статусов: выездные / обычные ----
    pgm.addColumns('unit_statuses', {
        group_kind: { type: 'text', notNull: true, default: 'normal' },
    });
    pgm.sql(`
        UPDATE unit_statuses
        SET group_kind = 'dispatch'
        WHERE name IN (
            'В дороге к месту вызова',
            'На месте вызова',
            'Возвращается с места вызова'
        );
    `);
    // Остальные системные статусы — обычные
    pgm.sql(`
        UPDATE unit_statuses
        SET group_kind = 'normal'
        WHERE group_kind <> 'dispatch';
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('unit_statuses', ['group_kind']);
    pgm.dropColumns('call_units', ['dispatch_at', 'arrival_at']);
    pgm.dropTable('unit_metrics_history');
    pgm.dropIndex('units', 'call_id');
    pgm.dropColumns('units', ['call_id', 'fuel_gasoline', 'fuel_diesel', 'foam_agent', 'powder', 'mileage']);
    pgm.dropColumns('unit_types', ['category']);
};