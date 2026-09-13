exports.up = (pgm) => {
    // ============================================================
    // 1. СПРАВОЧНИК ТИПОВ ТЕХНИКИ
    // ============================================================
    pgm.createTable('unit_types', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },          // полное: "Автолестница"
        short_name: { type: 'text', notNull: true },    // сокращённое: "АЛ"
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
    pgm.createIndex('unit_types', 'sort_order');

    // ============================================================
    // 2. СПРАВОЧНИК СТАТУСОВ
    // ============================================================
    pgm.createTable('unit_statuses', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: { type: 'text', notNull: true },          // полное
        short_name: { type: 'text', notNull: true },    // сокращённое
        color: { type: 'text', notNull: true },         // hex, например "#16a34a"
        color_name: { type: 'text' },                   // "Зелёный" — для UI
        sort_order: { type: 'integer', notNull: true, default: 0 },
        is_system: { type: 'boolean', notNull: true, default: false },
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
    pgm.createIndex('unit_statuses', 'sort_order');

    // ============================================================
    // 3. ДЕФОЛТНЫЕ ТИПЫ
    // ============================================================
    pgm.sql(`
    INSERT INTO unit_types (name, short_name, sort_order) VALUES
      ('Автолестница',      'АЛ',  10),
      ('Автоцистерна',      'АЦ',  20),
      ('Автобус',           'Автобус', 30),
      ('Автомобиль рукавный','АР',  40),
      ('Автомобиль штабной','АШ',  50),
      ('Автомобиль связи',  'АС',  60),
      ('Автомобиль пенного тушения', 'АПТ', 70);
  `);

    // ============================================================
    // 4. ДЕФОЛТНЫЕ СТАТУСЫ
    // ============================================================
    pgm.sql(`
    INSERT INTO unit_statuses (name, short_name, color, color_name, sort_order, is_system) VALUES
      ('В боевом расчёте',            'В расчете',       '#16a34a', 'Зелёный',         10, true),
      ('В боевом резерве',            'В резерве',       '#a3a334', 'Хаки',            20, true),
      ('В дороге к месту вызова',     'в дороге к м/в',  '#dc00ff', 'Фиолетовый',      30, true),
      ('На месте вызова',             'на месте вызова', '#dc2626', 'Красный',         40, true),
      ('Возвращается с места вызова', 'Возвращается',    '#2563eb', 'Синий',           50, true),
      ('В ремонте',                   'В ремонте',       '#808080', 'Серый', 60, true);
  `);

    // ============================================================
    // 5. ОБНОВЛЕНИЕ ТАБЛИЦЫ units
    // ============================================================
    // Добавляем новые колонки
    pgm.addColumns('units', {
        type_id: {
            type: 'uuid',
            references: 'unit_types(id)',
            onDelete: 'SET NULL',
        },
        status_id: {
            type: 'uuid',
            references: 'unit_statuses(id)',
            onDelete: 'SET NULL',
        },
        squad_number: { type: 'integer' },                 // 1-10, номер отделения
        show_in_grid: { type: 'boolean', notNull: true, default: true },
    });

    // Ставим дефолтный статус "В боевом расчёте" для существующих записей
    pgm.sql(`
    UPDATE units
    SET status_id = (SELECT id FROM unit_statuses WHERE short_name = 'В расчете' LIMIT 1)
    WHERE status_id IS NULL;
  `);

    // Удаляем старые текстовые колонки
    pgm.dropColumn('units', 'type');
    pgm.dropColumn('units', 'status');

    // Индексы для быстрого поиска
    pgm.createIndex('units', 'type_id');
    pgm.createIndex('units', 'status_id');
    pgm.createIndex('units', 'show_in_grid');
    // Ограничение на номер отделения
    pgm.addConstraint('units', 'units_squad_number_check', {
        check: 'squad_number IS NULL OR (squad_number >= 1 AND squad_number <= 10)',
    });

    // ============================================================
    // 6. ИСТОРИЯ СТАТУСОВ
    // ============================================================
    pgm.createTable('unit_status_history', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        unit_id: {
            type: 'uuid',
            notNull: true,
            references: 'units(id)',
            onDelete: 'CASCADE',
        },
        status_id: {
            type: 'uuid',
            references: 'unit_statuses(id)',
            onDelete: 'SET NULL',
        },
        status_name: { type: 'text' },                  // денормализация: снимок имени
        status_short_name: { type: 'text' },            // денормализация: снимок сокращения
        status_color: { type: 'text' },                 // денормализация: снимок цвета
        changed_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
        comment: { type: 'text' },                      // на будущее: комментарий к изменению
        changed_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });
    pgm.createIndex('unit_status_history', ['unit_id', 'changed_at']);
    pgm.createIndex('unit_status_history', 'changed_at');
};

exports.down = (pgm) => {
    pgm.dropTable('unit_status_history');

    pgm.dropConstraint('units', 'units_squad_number_check');
    pgm.dropIndex('units', 'show_in_grid');
    pgm.dropIndex('units', 'status_id');
    pgm.dropIndex('units', 'type_id');

    // Восстанавливаем старые колонки
    pgm.addColumns('units', {
        type: { type: 'text', notNull: false },
        status: { type: 'text', notNull: false },
    });

    pgm.dropColumns('units', [
        'type_id',
        'status_id',
        'squad_number',
        'show_in_grid',
    ]);

    pgm.dropTable('unit_statuses');
    pgm.dropTable('unit_types');
};