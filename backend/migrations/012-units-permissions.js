exports.up = (pgm) => {
    // admin — все права техники
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "units.update_status",
      "units.view_history",
      "units.manage_dictionaries"
    ]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'units.update_status');
  `);

    // dispatcher — менять статус + смотреть историю (без управления справочниками)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '[
      "units.update_status",
      "units.view_history"
    ]'::jsonb
    WHERE code = 'dispatcher'
      AND NOT (permissions ? 'units.update_status');
  `);

    // viewer — смотреть историю (без изменения статуса)
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["units.view_history"]'::jsonb
    WHERE code = 'viewer'
      AND NOT (permissions ? 'units.view_history');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT IN (
        'units.update_status',
        'units.view_history',
        'units.manage_dictionaries'
      )
    )
    WHERE permissions @> '["units.update_status"]'::jsonb
       OR permissions @> '["units.view_history"]'::jsonb
       OR permissions @> '["units.manage_dictionaries"]'::jsonb;
  `);
};