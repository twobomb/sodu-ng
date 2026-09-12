let audioCtx = null;

/**
 * Создаёт AudioContext и пытается его разбудить.
 * Вызывать ТОЛЬКО из user gesture (клик, клавиша, касание).
 */
export const initAudio = () => {
    if (audioCtx && audioCtx.state !== 'closed') {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;

        audioCtx = new Ctx();

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        return audioCtx;
    } catch (err) {
        console.warn('AudioContext не поддерживается:', err.message);
        return null;
    }
};

const _play = (ctx) => {
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.value = 800;
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.start(now);
    osc1.stop(now + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.value = 1000;
    gain2.gain.setValueAtTime(0.0001, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.4);
};

/**
 * Проигрывает звук. Если контекст не "running" — молча выходим.
 * НЕ вызываем resume здесь: сообщения приходят не из user gesture,
 * и браузер всё равно не даст звук. А накопление промисов приводит
 * к тому, что все звуки играются разом после первого клика.
 */
export const playNotificationSound = () => {
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state !== 'running') return;
    _play(ctx);
};

// ============================================================
// Настройка звука в localStorage
// ============================================================
const SOUND_KEY = 'chat_sound_enabled';

export const isSoundEnabled = () => {
    const val = localStorage.getItem(SOUND_KEY);
    return val === null ? true : val === 'true';
};

export const setSoundEnabled = (enabled) => {
    localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
};