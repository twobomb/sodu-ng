import { initAudio } from './notificationSound';

const SOUND_KEY = 'call_sound_enabled';

export const isCallSoundEnabled = () => {
    const val = localStorage.getItem(SOUND_KEY);
    return val === null ? true : val === 'true';
};

export const setCallSoundEnabled = (enabled) => {
    localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('call:ui-prefs-changed'));
};

export const subscribeToCallUiPrefs = (cb) => {
    window.addEventListener('call:ui-prefs-changed', cb);
    return () => window.removeEventListener('call:ui-prefs-changed', cb);
};

/**
 * Сигнал о новом вызове — три тона (нисходящий затем высокий отклик).
 * Используется на страницах «Вызовы» и «Мониторинг вызовов» при создании
 * нового вызова, к которому у пользователя есть доступ.
 */
export const playNewCallSound = () => {
    const ctx = initAudio();
    if (!ctx) return;
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const tones = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 660, start: 0.15, dur: 0.12 },
        { freq: 990, start: 0.3, dur: 0.18 },
    ];

    tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.start(now + start);
        osc.stop(now + start + dur);
    });
};