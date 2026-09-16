/* eslint-disable no-undef */
// ============================================================
// Чистка устаревших прав раздела «Пожары» (fires.*)
// после его удаления. Оставляем только права из текущего каталога.
// ============================================================
exports.up = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
      FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT LIKE 'fires.%'
    )
    WHERE permissions ? 'fires.view'
       OR permissions ? 'fires.create'
       OR permissions ? 'fires.update'
       OR permissions ? 'fires.delete';
  `);
};

exports.down = (pgm) => {
    // Удаление прав нельзя безопасно откатить (не сохраняли исходный набор),
    // поэтому down — пустая операция.
    pgm.noop();
};