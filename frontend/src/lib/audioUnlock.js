import { initAudio } from './notificationSound';

let installed = false;

/**
 * Устанавливает глобальные слушатели, которые пробуждают AudioContext
 * при любом взаимодействии пользователя со страницей.
 * Устанавливается один раз на всё приложение.
 */
export const installAudioUnlock = () => {
    if (installed) return;
    installed = true;

    const wake = () => {
        initAudio();
    };

    window.addEventListener('click', wake, { passive: true });
    window.addEventListener('keydown', wake, { passive: true });
    window.addEventListener('touchstart', wake, { passive: true });
};