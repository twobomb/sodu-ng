/* eslint-disable no-undef */
// ============================================================
// ВЫЗОВЫ (замена «Пожаров»)
// Таблицы: calls, call_units, call_events
// ============================================================
exports.up = (pgm) => {
    // ---- Основная таблица вызовов ----
    pgm.createTable('calls', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        status: {
            type: 'text',
            notNull: true,
            default: 'processing',
            check: "status IN ('processing', 'closed', 'error')",
        },
        // Тип вызова: Пожар, АПС, АСР, ДТП, Помощь, ЛОХ, ПСП, ПТУ, Хоз. Работы
        type: { type: 'text' },
        // Ранг (только для типа «Пожар»)
        rank: { type: 'text' },
        // Дата и время возникновения события
        incident_at: { type: 'timestamp with time zone' },
        // Время получения сообщения
        message_received_at: { type: 'timestamp with time zone' },
        // Муниципальный / городской округ (пока текстовое поле)
        municipality: { type: 'text' },
        // Адрес места происшествия (пока текстовое поле)
        address: { type: 'text' },
        // Время высылки сил и средств
        dispatch_at: { type: 'timestamp with time zone' },
        // Время прибытия
        arrival_at: { type: 'timestamp with time zone' },
        // Локализация пожара
        localization_at: { type: 'timestamp with time zone' },
        // Ликвидация открытого горения
        open_fire_eliminated_at: { type: 'timestamp with time zone' },
        // Ликвидация пожара
        fire_eliminated_at: { type: 'timestamp with time zone' },
        // Описание
        description: { type: 'text' },
        created_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
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
    pgm.createIndex('calls', ['status', 'created_at']);
    pgm.createIndex('calls', 'incident_at');

    // ---- Привлекаемая техника (многие ко многим) ----
    pgm.createTable('call_units', {
        call_id: {
            type: 'uuid',
            notNull: true,
            references: 'calls(id)',
            onDelete: 'CASCADE',
        },
        unit_id: {
            type: 'uuid',
            notNull: true,
            references: 'units(id)',
            onDelete: 'CASCADE',
        },
    });
    pgm.addConstraint('call_units', 'call_units_pkey', {
        primaryKey: ['call_id', 'unit_id'],
    });

    // ---- Ход событий ----
    pgm.createTable('call_events', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
        },
        call_id: {
            type: 'uuid',
            notNull: true,
            references: 'calls(id)',
            onDelete: 'CASCADE',
        },
        event_at: {
            type: 'timestamp with time zone',
            notNull: true,
        },
        text: { type: 'text', notNull: true },
        created_by: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'SET NULL',
        },
        created_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });
    pgm.createIndex('call_events', ['call_id', 'event_at']);
    pgm.createIndex('call_events', ['call_id', 'created_at']);

    // ---- Права ролям ----
    // admin — все права вызовов (включая правку закрытых)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "calls.view",
      "calls.create",
      "calls.update",
      "calls.update_status",
      "calls.update_closed"
    ]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'calls.view');
  `);

    // dispatcher — просмотр, создание, редактирование, смена статуса (без правки закрытых)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "calls.view",
      "calls.create",
      "calls.update",
      "calls.update_status"
    ]'::jsonb
    WHERE code = 'dispatcher'
      AND NOT (permissions ? 'calls.view');
  `);

    // viewer — только просмотр
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["calls.view"]'::jsonb
    WHERE code = 'viewer'
      AND NOT (permissions ? 'calls.view');
  `);
};

exports.down = (pgm) => {
    pgm.dropTable('call_events');
    pgm.dropTable('call_units');
    pgm.dropTable('calls');

    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT LIKE 'calls.%'
    )
    WHERE permissions ? 'calls.view';
  `);
};