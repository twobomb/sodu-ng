// ============================================================
// Передача определения выборки через URL (?cq=<base64url>)
// ============================================================
// Кодируем JSON определения в base64url — так фильтр переживает перезагрузку
// страницы и его можно передать ссылкой.
const toBase64Url = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (b64) => {
    const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

// Определение → строка для query-параметра cq
export const encodeSampleDefinition = (definition) =>
    toBase64Url(JSON.stringify(definition));

// query-параметр cq → строка JSON определения (или null, если битый)
export const decodeSampleDefinition = (value) => {
    if (!value) return null;
    try {
        const json = fromBase64Url(value);
        // Проверяем, что это валидный JSON-объект
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') return null;
        return json;
    } catch {
        return null;
    }
};
