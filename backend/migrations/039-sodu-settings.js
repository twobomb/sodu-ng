exports.up = (pgm) => {
    // Глобальные настройки СОДУ (применяются ко всем пользователям).
    pgm.sql(`
    INSERT INTO system_settings (key, value) VALUES
      ('map_link_template', '"https://yandex.ru/maps/?&text=Луганская Народная Республика,$ADDRESS&z=14"'::jsonb),
      ('show_map_button', 'true'::jsonb),
      ('enable_address_autocomplete', 'true'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    DELETE FROM system_settings WHERE key IN (
      'map_link_template', 'show_map_button', 'enable_address_autocomplete'
    );
  `);
};