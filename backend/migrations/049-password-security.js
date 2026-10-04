/* eslint-disable no-undef */
// ============================================================
// Безопасность паролей.
//
//   • users.password_changed_at — когда пароль был изменён;
//   • users.password_expires_at — до какой даты действует пароль
//     (NULL — без ограничения по дате; администратор может задать вручную);
//   • system_settings.password_policy      — simple | medium | complex;
//   • system_settings.password_expiry_days — срок действия в днях (по умолчанию 30);
//   • право users.password_never_expires   — «Бессрочный пароль»
//     (входит в роль администратора по умолчанию).
// ============================================================

exports.up = (pgm) => {
    // 1. Колонки карточки пользователя
    pgm.addColumns('users', {
        password_changed_at: {
            type: 'timestamp with time zone',
            notNull: true,
            default: pgm.func('now()'),
        },
        password_expires_at: { type: 'timestamp with time zone' },
    });

    // 2. Настройки политики и срока действия
    pgm.sql(`
        INSERT INTO system_settings (key, value) VALUES
        ('password_policy', '"simple"'::jsonb),
        ('password_expiry_days', '30'::jsonb)
        ON CONFLICT (key) DO NOTHING;
    `);

    // 3. Действующим пользователям срок считаем от момента установки политики
    pgm.sql(`
        UPDATE users
        SET password_expires_at = NOW() + make_interval(days => 30)
        WHERE password_expires_at IS NULL;
    `);

    // 4. Право «Бессрочный пароль» — по умолчанию в роль администратора
    pgm.sql(`
        UPDATE roles
        SET permissions = permissions || '["users.password_never_expires"]'::jsonb
        WHERE code = 'admin'
          AND NOT (permissions ? 'users.password_never_expires');
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        UPDATE roles
        SET permissions = COALESCE((
            SELECT jsonb_agg(p) FROM jsonb_array_elements_text(permissions) p
            WHERE p <> 'users.password_never_expires'
        ), '[]'::jsonb)
        WHERE permissions @> '["users.password_never_expires"]'::jsonb;
    `);
    pgm.sql(`
        DELETE FROM system_settings
        WHERE key IN ('password_policy', 'password_expiry_days');
    `);
    pgm.dropColumns('users', ['password_changed_at', 'password_expires_at']);
};
