/**
 * Регулярка для эмодзи (Basic Emoji + Extended + ZWJ-последовательности).
 * Покрывает: 😀-🙏, 🚀-🛿, 🦀-🧿, ☀-⛿, флаги, семейные ZWJ-эмодзи.
 */
const EMOJI_REGEX =
    /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200D|\uFE0F|\s)+$/u;

const EMOJI_ONLY_REGEX =
    /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|\p{Emoji_Component})$/u;

/**
 * Возвращает true, если текст — только эмодзи (без букв, цифр, знаков препинания,
 * кроме пробелов). Считает количество эмодзи через Intl.Segmenter.
 */
export const analyzeEmojiContent = (text) => {
    if (!text) return { isEmojiOnly: false, count: 0 };

    const trimmed = text.trim();
    if (!trimmed) return { isEmojiOnly: false, count: 0 };

    // Проверяем, что в строке нет обычных букв/цифр/знаков
    // \p{L} — буквы, \p{N} — цифры
    if (/[\p{L}\p{N}]/u.test(trimmed)) {
        return { isEmojiOnly: false, count: 0 };
    }

    // Считаем эмодзи через Segmenter (графемы)
    try {
        const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' });
        const segments = [...segmenter.segment(trimmed)];

        // Каждый сегмент должен быть эмодзи или пробелом
        const emojiCount = segments.filter(({ segment }) => {
            const s = segment.trim();
            if (!s) return false;
            return EMOJI_ONLY_REGEX.test(s);
        }).length;

        // Если все непустые сегменты — эмодзи, и их от 1 до 3
        const nonEmptyCount = segments.filter(({ segment }) =>
            segment.trim()
        ).length;

        if (emojiCount === nonEmptyCount && emojiCount >= 1 && emojiCount <= 3) {
            return { isEmojiOnly: true, count: emojiCount };
        }
    } catch (_) {
        // Intl.Segmenter может отсутствовать — фоллбэк
    }

    return { isEmojiOnly: false, count: 0 };
};

/**
 * Возвращает Tailwind-класс размера шрифта в зависимости от количества эмодзи.
 */
export const getEmojiSizeClass = (count) => {
    if (count === 1) return 'text-6xl leading-none';
    if (count === 2) return 'text-5xl leading-none';
    if (count === 3) return 'text-4xl leading-none';
    return '';
};