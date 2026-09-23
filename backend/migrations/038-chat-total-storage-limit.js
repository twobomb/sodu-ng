exports.up = (pgm) => {
    // Общий максимальный размер хранимых файлов (в гигабайтах).
    // Значение по умолчанию — 400 ГБ.
    pgm.sql(`
    INSERT INTO system_settings (key, value) VALUES
      ('chat_max_total_storage_gb', '400'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.sql(
        `DELETE FROM system_settings WHERE key = 'chat_max_total_storage_gb';`
    );
};