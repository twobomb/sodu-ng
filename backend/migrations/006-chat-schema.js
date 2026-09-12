exports.up = (pgm) => {
    // ============ CONVERSATIONS ============
    // Одна таблица для: личных чатов, групп, каналов и "Избранного"
    pgm.createTable('conversations', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        type: {
            type: 'text',
            notNull: true,
            check: "type IN ('direct','group','channel','saved')",
        },
        name: { type: 'text' },
        description: { type: 'text' },
        avatar_url: { type: 'text' },
        is_readonly: { type: 'boolean', notNull: true, default: false },
        is_system: { type: 'boolean', notNull: true, default: false },
        system_key: { type: 'text' },                 // 'general' | 'saved' | null
        owner_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' }, // для saved
        created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
        last_message_at: { type: 'timestamp with time zone' },
    });
    pgm.createIndex('conversations', 'type');
    pgm.createIndex('conversations', 'last_message_at');

    // Уникальный "Общий" канал
    pgm.createIndex('conversations', ['system_key'], {
        unique: true,
        where: "system_key = 'general'",
        name: 'conversations_general_unique',
    });
    // Уникальное "Избранное" на пользователя
    pgm.createIndex('conversations', ['system_key', 'owner_id'], {
        unique: true,
        where: "system_key = 'saved'",
        name: 'conversations_saved_unique_per_user',
    });

    // ============ MEMBERS ============
    pgm.createTable('conversation_members', {
        conversation_id: {
            type: 'uuid', notNull: true,
            references: 'conversations(id)', onDelete: 'CASCADE',
        },
        user_id: {
            type: 'uuid', notNull: true,
            references: 'users(id)', onDelete: 'CASCADE',
        },
        role: {
            type: 'text', notNull: true, default: 'member',
            check: "role IN ('member','admin')",
        },
        is_pinned: { type: 'boolean', notNull: true, default: false },
        pinned_at: { type: 'timestamp with time zone' },
        last_read_at: { type: 'timestamp with time zone' },
        joined_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });
    pgm.addConstraint('conversation_members', 'conversation_members_pkey', {
        primaryKey: ['conversation_id', 'user_id'],
    });
    pgm.createIndex('conversation_members', 'user_id');

    // ============ MESSAGES ============
    pgm.createTable('messages', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        conversation_id: {
            type: 'uuid', notNull: true,
            references: 'conversations(id)', onDelete: 'CASCADE',
        },
        user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
        content: { type: 'text' },
        content_type: {
            type: 'text', notNull: true, default: 'text',
            check: "content_type IN ('text','file','image','system')",
        },
        reply_to_id: { type: 'uuid', references: 'messages(id)', onDelete: 'SET NULL' },
        edited_at: { type: 'timestamp with time zone' },
        deleted_at: { type: 'timestamp with time zone' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });
    // Главный индекс для пагинации: WHERE conversation_id = ? ORDER BY created_at DESC
    pgm.createIndex('messages', ['conversation_id', 'created_at']);
    pgm.createIndex('messages', 'user_id');
    pgm.createIndex('messages', 'reply_to_id');

    // ============ ATTACHMENTS ============
    pgm.createTable('attachments', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        message_id: {
            type: 'uuid', notNull: true,
            references: 'messages(id)', onDelete: 'CASCADE',
        },
        original_name: { type: 'text', notNull: true },
        stored_name: { type: 'text', notNull: true },   // имя файла на диске
        mime_type: { type: 'text' },
        size: { type: 'bigint', notNull: true },
        width: { type: 'integer' },                     // для картинок
        height: { type: 'integer' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });
    pgm.createIndex('attachments', 'message_id');

    // ============ MESSAGE READS ============
    // Храним только "последнее прочитанное" на пользователя — этого достаточно
    // для галочек и для "кто прочитал", если брать MAX(read_at) по участникам.
    pgm.createTable('message_reads', {
        conversation_id: {
            type: 'uuid', notNull: true,
            references: 'conversations(id)', onDelete: 'CASCADE',
        },
        user_id: {
            type: 'uuid', notNull: true,
            references: 'users(id)', onDelete: 'CASCADE',
        },
        last_read_message_id: {
            type: 'uuid', references: 'messages(id)', onDelete: 'SET NULL',
        },
        last_read_at: {
            type: 'timestamp with time zone',
            default: pgm.func('now()'),
            notNull: true,
        },
    });
    pgm.addConstraint('message_reads', 'message_reads_pkey', {
        primaryKey: ['conversation_id', 'user_id'],
    });

    // ============ USER CHAT PROFILES ============
    // Имя и аватар пользователя именно в чате (не путать с users.username)
    pgm.createTable('user_chat_profiles', {
        user_id: {
            type: 'uuid', primaryKey: true,
            references: 'users(id)', onDelete: 'CASCADE',
        },
        display_name: { type: 'text' },
        avatar_url: { type: 'text' },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('now()'), notNull: true },
    });

    // ============ НАСТРОЙКИ ЧАТА ============
    pgm.sql(`
    INSERT INTO system_settings (key, value) VALUES
      ('chat_max_pinned_chats', '5'::jsonb),
      ('chat_max_pinned_channels', '5'::jsonb),
      ('chat_max_file_size_mb', '20'::jsonb),
      ('chat_edit_window_minutes', '10'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);

    // ============ ОБЩИЙ КАНАЛ ============
    pgm.sql(`
    INSERT INTO conversations (type, name, description, is_system, system_key, is_readonly)
    VALUES ('channel', 'Общий', 'Общий канал для всех пользователей', true, 'general', false)
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.dropTable('message_reads');
    pgm.dropTable('attachments');
    pgm.dropTable('messages');
    pgm.dropTable('conversation_members');
    pgm.dropTable('user_chat_profiles');
    pgm.dropTable('conversations');

    pgm.sql(`
    DELETE FROM system_settings WHERE key IN (
      'chat_max_pinned_chats',
      'chat_max_pinned_channels',
      'chat_max_file_size_mb',
      'chat_edit_window_minutes'
    );
  `);
};