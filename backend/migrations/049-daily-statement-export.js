/* eslint-disable no-undef */
// ============================================================
// Суточная ведомость: право выгрузки
//   daily_statement.export — видеть раздел «Отчёты → Выгрузка суточной ведомости»
//   и формировать xls по шаблону.
// Назначается ролям admin и dispatcher.
// ============================================================
exports.up = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["daily_statement.export"]'::jsonb
    WHERE code IN ('admin', 'dispatcher')
      AND NOT (permissions ? 'daily_statement.export');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p <> 'daily_statement.export'
    )
    WHERE permissions @> '["daily_statement.export"]'::jsonb;
  `);
};
