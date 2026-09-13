exports.up = (pgm) => {
    // admin — всё
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["users.view_online"]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'users.view_online');
  `);

    // dispatcher — видит онлайн (полезно диспетчеру)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["users.view_online"]'::jsonb
    WHERE code = 'dispatcher'
      AND NOT (permissions ? 'users.view_online');
  `);

    // viewer — видит онлайн
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["users.view_online"]'::jsonb
    WHERE code = 'viewer'
      AND NOT (permissions ? 'users.view_online');
  `);

    // developer игнорирует проверки, ему не нужно
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p <> 'users.view_online'
    )
    WHERE permissions @> '["users.view_online"]'::jsonb;
  `);
};