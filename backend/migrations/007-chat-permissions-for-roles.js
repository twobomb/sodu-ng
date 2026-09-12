exports.up = (pgm) => {
    // admin — всё, кроме ничего (все чат-права)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "chat.use","chat.create_channel","chat.update_channel",
      "chat.delete_channel","chat.manage_members","chat.moderate","chat.manage_profiles"
    ]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'chat.use');
  `);

    // dispatcher — пользоваться, создавать каналы, модерировать свои
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "chat.use","chat.create_channel","chat.moderate"
    ]'::jsonb
    WHERE code = 'dispatcher'
      AND NOT (permissions ? 'chat.use');
  `);

    // viewer — только пользоваться
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["chat.use"]'::jsonb
    WHERE code = 'viewer'
      AND NOT (permissions ? 'chat.use');
  `);

    // developer игнорирует проверки, ему можно ничего не давать
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT LIKE 'chat.%'
    )
    WHERE permissions @> '["chat.use"]'::jsonb;
  `);
};