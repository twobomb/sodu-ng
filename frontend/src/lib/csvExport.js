/**
 * Экранирует значение для CSV:
 * - оборачивает в кавычки
 * - удваивает внутренние кавычки
 */
const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Если есть запятая, кавычка или перевод строки — оборачиваем
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Формирует CSV-строку из массива объектов.
 * @param {Array<Object>} rows — массив объектов
 * @param {Array<{key: string, label: string}>} columns — описание колонок
 */
export const buildCsv = (rows, columns) => {
    const header = columns.map((c) => escapeCsv(c.label)).join(';');
    const body = rows
        .map((row) =>
            columns.map((c) => escapeCsv(row[c.key])).join(';')
        )
        .join('\r\n');
    return `${header}\r\n${body}`;
};

/**
 * Скачивает CSV-файл. Используем BOM + UTF-8, чтобы Excel корректно
 * открывал кириллицу.
 */
export const downloadCsv = (filename, csvContent) => {
    // BOM для Excel
    const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Форматирует timestamp для имени файла: units-grid_2026-09-12_15-30.csv
 */
export const timestampForFilename = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `_${pad(d.getHours())}-${pad(d.getMinutes())}`
    );
};