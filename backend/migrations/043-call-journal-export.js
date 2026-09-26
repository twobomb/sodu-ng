/* eslint-disable no-undef */
// ============================================================
// Журнал вызовов: право выгрузки
//   call_journal.export — видеть раздел «Отчёты → Выгрузка журнала вызовов»
//   и формировать xlsx по шаблону.
// Назначается ролям admin и dispatcher.
// ============================================================
exports.up = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["call_journal.export"]'::jsonb
    WHERE code IN ('admin', 'dispatcher')
      AND NOT (permissions ? 'call_journal.export');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p <> 'call_journal.export'
    )
    WHERE permissions @> '["call_journal.export"]'::jsonb;
  `);
};