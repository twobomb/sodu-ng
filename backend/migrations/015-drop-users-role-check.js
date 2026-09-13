exports.up = (pgm) => {
    // Убираем старый CHECK — теперь роль валидируется через FK на roles.code
    pgm.dropConstraint('users', 'users_role_check', { ifExists: true });
};

exports.down = (pgm) => {
    // Возвращаем, если откатывать миграцию
    pgm.addConstraint('users', 'users_role_check', {
        check: "role IN ('developer', 'admin', 'dispatcher', 'viewer')",
    });
};