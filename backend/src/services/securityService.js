const settingsService = require('./settingsService');
const {
    DEFAULT_POLICY,
    DEFAULT_EXPIRY_DAYS,
    WARNING_DAYS,
    POLICY_KEYS,
    getPolicy,
    policyRequirements,
    validatePassword,
} = require('../utils/passwordPolicy');

// Право роли: пользователю не важен срок действия пароля
const NEVER_EXPIRES_PERMISSION = 'users.password_never_expires';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Настройки (хранятся в system_settings)
// ------------------------------------------------------------
const getPolicyKey = async () => {
    const raw = await settingsService.get('password_policy');
    return POLICY_KEYS.includes(raw) ? raw : DEFAULT_POLICY;
};

const getExpiryDays = async () => {
    const raw = Number(await settingsService.get('password_expiry_days'));
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_EXPIRY_DAYS;
    return Math.min(3650, Math.floor(raw));
};

// Данные для UI разработчика и для подсказок требований к паролю
const getSecuritySettings = async () => {
    const passwordPolicy = await getPolicyKey();
    const expiryDays = await getExpiryDays();
    const policy = getPolicy(passwordPolicy);
    return {
        password_policy: passwordPolicy,
        password_expiry_days: expiryDays,
        warning_days: WARNING_DAYS,
        policy: {
            key: policy.key,
            label: policy.label,
            min: policy.min,
            short: policy.short,
            requirements: policyRequirements(policy.key),
        },
    };
};

const updateSecuritySettings = async ({ passwordPolicy, expiryDays, updatedBy }) => {
    if (passwordPolicy !== undefined) {
        await settingsService.set('password_policy', passwordPolicy, updatedBy);
    }
    if (expiryDays !== undefined) {
        await settingsService.set('password_expiry_days', Number(expiryDays), updatedBy);
    }
    return getSecuritySettings();
};

// ------------------------------------------------------------
// Срок действия пароля
// ------------------------------------------------------------
const computeExpiresAt = (days, from = new Date()) => (
    days > 0 ? new Date(from.getTime() + days * MS_PER_DAY) : null
);

// Владелец «Бессрочного пароля» (и разработчик) не ограничен сроком
const isNeverExpires = (user) => {
    if (!user) return false;
    if (user.role === 'developer') return true;
    return (user.permissions || []).includes(NEVER_EXPIRES_PERMISSION);
};

/**
 * Статус срока действия пароля пользователя.
 * @returns {{
 *   never_expires: boolean, expires_at: Date|null, days_left: number|null,
 *   expiring_soon: boolean, expired: boolean, warning_days: number
 * }}
 */
const getPasswordStatus = (user, now = new Date()) => {
    const neverExpires = isNeverExpires(user);
    const expiresAt = user?.password_expires_at ? new Date(user.password_expires_at) : null;

    if (neverExpires || !expiresAt || Number.isNaN(expiresAt.getTime())) {
        return {
            never_expires: neverExpires,
            expires_at: expiresAt,
            days_left: null,
            expiring_soon: false,
            expired: false,
            warning_days: WARNING_DAYS,
        };
    }

    const msLeft = expiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
    const expired = msLeft <= 0;
    return {
        never_expires: false,
        expires_at: expiresAt,
        days_left: Math.max(0, daysLeft),
        // просроченный пароль тоже считается «требующим внимания»
        expiring_soon: expired || daysLeft <= WARNING_DAYS,
        expired,
        warning_days: WARNING_DAYS,
    };
};

/**
 * Плоский набор полей статуса — добавляется в объект пользователя,
 * который отдаётся на фронтенд (без password_hash).
 */
const buildPasswordInfo = (user) => {
    const status = getPasswordStatus(user);
    return {
        password_changed_at: user?.password_changed_at || null,
        password_expires_at: status.expires_at,
        password_days_left: status.days_left,
        password_expiring_soon: status.expiring_soon,
        password_expired: status.expired,
        password_never_expires: status.never_expires,
        password_warning_days: status.warning_days,
    };
};

module.exports = {
    NEVER_EXPIRES_PERMISSION,
    getPolicyKey,
    getExpiryDays,
    getSecuritySettings,
    updateSecuritySettings,
    computeExpiresAt,
    isNeverExpires,
    getPasswordStatus,
    buildPasswordInfo,
    validatePassword,
};
