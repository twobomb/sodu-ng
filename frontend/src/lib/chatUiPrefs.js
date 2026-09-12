// ============================================================
// Пользовательские настройки интерфейса чата.
// Хранятся локально в браузере (per-device, per-browser).
// При изменении рассылают событие, чтобы UI мгновенно реагировал.
// ============================================================

const FLOATING_KEY = 'chat_floating_button_enabled';
const CHANGED_EVENT = 'chat:ui-prefs-changed';

export const isFloatingButtonEnabled = () => {
    const val = localStorage.getItem(FLOATING_KEY);
    return val === null ? true : val === 'true';
};

export const setFloatingButtonEnabled = (enabled) => {
    localStorage.setItem(FLOATING_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
};

/**
 * Подписка на изменение настроек.
 * Возвращает функцию отписки.
 */
export const subscribeToUiPrefs = (cb) => {
    window.addEventListener(CHANGED_EVENT, cb);
    return () => window.removeEventListener(CHANGED_EVENT, cb);
};