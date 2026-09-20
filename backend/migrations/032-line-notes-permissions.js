/* eslint-disable no-undef */
// ============================================================
// Строевая записка: дополнительные права
//   line_notes.approve        — утверждение (перевод в «Утверждённая»)
//   line_notes.edit_approved  — редактирование утверждённых + возврат в черновик
// Назначаются:
//   admin      — все права (view/manage/approve/edit_approved)
//   dispatcher — view/manage/approve (без edit_approved по умолчанию)
// ============================================================
exports.up = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["line_notes.approve","line_notes.edit_approved"]'::jsonb
    WHERE code = 'admin'
      AND NOT (permissions ? 'line_notes.edit_approved');
  `);

    pgm.sql(`
    UPDATE roles
    SET permissions = permissions || '["line_notes.approve"]'::jsonb
    WHERE code = 'dispatcher'
      AND NOT (permissions ? 'line_notes.approve');
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    UPDATE roles
    SET permissions = (
      SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
      WHERE p NOT IN ('line_notes.approve', 'line_notes.edit_approved')
    )
    WHERE permissions @> '["line_notes.approve"]'::jsonb
       OR permissions @> '["line_notes.edit_approved"]'::jsonb;
  `);
};