/**
 * Строит ссылку на карту из шаблона (например, у Яндекс.Карт).
 * Плейсхолдер $ADDRESS заменяется на сам адрес (URL-экранированный).
 */
export const buildMapUrl = (template, address) => {
    if (!template) return null;
    return template.replace(/\$ADDRESS/g, encodeURIComponent(address || ''));
};