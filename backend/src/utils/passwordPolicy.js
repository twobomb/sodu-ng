// ============================================================
// Политики сложности пароля.
//
// Используются при создании пользователя, смене пароля (самостоятельной
// и администратором). Сама политика хранится в system_settings
// (ключ password_policy) и настраивается разработчиком.
// ============================================================

const DEFAULT_POLICY = 'simple';
const DEFAULT_EXPIRY_DAYS = 30;
// За сколько дней до истечения начинаем предупреждать пользователя
const WARNING_DAYS = 5;

// Проверки «что обязательно должно быть в пароле»
const CHECKS = {
    letter: { test: (p) => /[A-Za-zА-Яа-яЁё]/.test(p), text: 'буквы' },
    digit: { test: (p) => /\d/.test(p), text: 'цифры' },
    upper: { test: (p) => /[A-ZА-ЯЁ]/.test(p), text: 'хотя бы одна заглавная буква' },
    lower: { test: (p) => /[a-zа-яё]/.test(p), text: 'хотя бы одна строчная буква' },
    special: { test: (p) => /[\p{P}\p{S}]/u.test(p), text: 'хотя бы один специальный символ' },
};

// Определения политик
const POLICIES = {
    simple: {
        key: 'simple',
        label: 'Простой',
        min: 8,
        checks: [],
        short: 'минимум 8 символов',
    },
    medium: {
        key: 'medium',
        label: 'Средний',
        min: 10,
        checks: ['letter', 'digit', 'upper', 'lower'],
        short: 'минимум 10 символов, буквы и цифры, заглавная и строчная буквы',
    },
    complex: {
        key: 'complex',
        label: 'Сложный',
        min: 12,
        checks: ['letter', 'digit', 'upper', 'lower', 'special'],
        short: 'минимум 12 символов, буквы в разных регистрах, цифры и специальный символ',
    },
};

const POLICY_KEYS = Object.keys(POLICIES);

// Политика по умолчанию (если в настройках мусор)
const getPolicy = (key) => POLICIES[key] || POLICIES[DEFAULT_POLICY];

// Требования политики в виде списка «минимум N символов», «цифры» и т. д.
const policyRequirements = (key) => {
    const policy = getPolicy(key);
    return [
        `минимум ${policy.min} символов`,
        ...policy.checks.map((c) => CHECKS[c].text),
    ];
};

/**
 * Проверяет пароль по политике.
 * @returns {{ ok: boolean, error?: string, unmet?: string[] }}
 */
const validatePassword = (password, policyKey) => {
    const policy = getPolicy(policyKey);
    const pwd = typeof password === 'string' ? password : '';

    const unmet = [];
    if (pwd.length < policy.min) unmet.push(`минимум ${policy.min} символов`);
    for (const check of policy.checks) {
        if (!CHECKS[check].test(pwd)) unmet.push(CHECKS[check].text);
    }

    if (unmet.length || !pwd) {
        return {
            ok: false,
            unmet,
            error: `Пароль не соответствует требованиям (${policy.label}): ${(unmet.length ? unmet : ['пароль не может быть пустым']).join(', ')}`,
        };
    }
    return { ok: true };
};

module.exports = {
    DEFAULT_POLICY,
    DEFAULT_EXPIRY_DAYS,
    WARNING_DAYS,
    POLICIES,
    POLICY_KEYS,
    getPolicy,
    policyRequirements,
    validatePassword,
};
