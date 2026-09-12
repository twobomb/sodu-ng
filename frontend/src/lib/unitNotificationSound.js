import { initAudio } from './notificationSound';

const SOUND_KEY = 'unit_sound_enabled';

export const isUnitSoundEnabled = () => {
    const val = localStorage.getItem(SOUND_KEY);
    return val === null ? true : val === 'true';
};

export const setUnitSoundEnabled = (enabled) => {
    localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('unit:ui-prefs-changed'));
};

export const subscribeToUnitUiPrefs = (cb) => {
    window.addEventListener('unit:ui-prefs-changed', cb);
    return () => window.removeEventListener('unit:ui-prefs-changed', cb);
};

/**
 * Тревожный сигнал — три коротких высоких тона.
 * Используется на странице "Вся техника" при смене статуса.
 */
export const playUnitStatusSound = () => {
    const ctx = initAudio();
    if (!ctx) return;
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const tones = [
        { freq: 1200, start: 0, dur: 0.08 },
        { freq: 1400, start: 0.12, dur: 0.08 },
        { freq: 1600, start: 0.24, dur: 0.14 },
    ];

    tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.start(now + start);
        osc.stop(now + start + dur);
    });
};