// ============================================================
// Колонки таблицы «Список вызовов».
//
// default — колонка видна по умолчанию (набор такой же, как был до настройки).
// Порядок колонок пользователь задаёт перетаскиванием, он сохраняется.
// ============================================================
export const CALLS_COLUMNS = [
    { key: 'call_code', label: 'Идентификатор', default: true },
    { key: 'incident_at', label: 'Дата и время возникновения события' },
    { key: 'message_received_at', label: 'Время получения сообщения' },
    { key: 'created_at', label: 'Создан', default: true },
    { key: 'address', label: 'Адрес', default: true },
    { key: 'description', label: 'Описание (показывается начало)' },
    { key: 'municipality_name', label: 'Округ', default: true },
    { key: 'type', label: 'Тип вызова', default: true },
    { key: 'units_count', label: 'Техника', default: true },
    { key: 'carryover_fire', label: 'Переходящий пожар' },
    { key: 'false_call', label: 'ЛОЖНЫЙ ВЫЗОВ' },
    { key: 'status', label: 'Статус', default: true },
];

export const ALL_COLUMN_KEYS = CALLS_COLUMNS.map((c) => c.key);

// Состояние по умолчанию: порядок как в каталоге, скрыты не-«default»
export const defaultColumnsState = () => ({
    order: [...ALL_COLUMN_KEYS],
    hidden: CALLS_COLUMNS.filter((c) => !c.default).map((c) => c.key),
});

/**
 * Приводит сохранённое значение к актуальному виду:
 *  - поддерживает старый формат (массив видимых ключей);
 *  - убирает неизвестные ключи и добавляет новые из каталога;
 *  - гарантирует, что видимой остаётся хотя бы одна колонка.
 */
export const normalizeColumnsState = (raw) => {
    const base = defaultColumnsState();

    // Старый формат: массив видимых колонок
    if (Array.isArray(raw)) {
        return normalizeColumnsState({
            order: base.order,
            hidden: ALL_COLUMN_KEYS.filter((k) => !raw.includes(k)),
        });
    }
    if (!raw || typeof raw !== 'object') return base;

    const savedOrder = Array.isArray(raw.order) ? raw.order : [];
    const order = [
        ...savedOrder.filter((k) => ALL_COLUMN_KEYS.includes(k)),
        ...ALL_COLUMN_KEYS.filter((k) => !savedOrder.includes(k)),
    ];
    const savedHidden = Array.isArray(raw.hidden) ? raw.hidden : base.hidden;
    let hidden = savedHidden.filter((k) => ALL_COLUMN_KEYS.includes(k));

    // Нельзя скрыть все колонки — оставляем первую по порядку
    if (hidden.length >= ALL_COLUMN_KEYS.length) {
        hidden = ALL_COLUMN_KEYS.filter((k) => k !== order[0]);
    }

    return { order, hidden };
};

// Видимые колонки в заданном пользователем порядке
export const visibleColumnsOf = (state) => {
    const { order, hidden } = normalizeColumnsState(state);
    return order
        .filter((k) => !hidden.includes(k))
        .map((k) => CALLS_COLUMNS.find((c) => c.key === k))
        .filter(Boolean);
};
