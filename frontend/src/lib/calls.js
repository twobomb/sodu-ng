import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// ============================================================
// КОНСТАНТЫ ВЫЗОВОВ
// ============================================================
export const CALL_TYPES = [
    'Пожар',
    'АПС',
    'АСР',
    'ДТП',
    'Помощь',
    'ЛОХ',
    'Ложное сообщение',
    'Ложное срабатывание АПС',
    'ПСП',
    'ПТУ',
    'Хоз. Работы',
];

// Типы вызова, которые считаются «ложными»
export const FALSE_CALL_TYPES = ['Ложное сообщение', 'Ложное срабатывание АПС'];

// Является ли вызов ложным (по типу вызова)
export const isFalseCallType = (type) => FALSE_CALL_TYPES.includes(type);

// Типы вызовов, для которых в карточке открываются все «пожарные» блоки
export const FIRE_TYPES = [
    'Пожар',
    'ЛОХ',
    'АПС',
    'ПТУ',
    'Ложное сообщение',
    'Ложное срабатывание АПС',
];

export const CALL_RANKS = [
    'Ранг №1',
    'Ранг №1-БИС',
    'Ранг №2',
    'Ранг №3',
    'Ранг №4',
    'Ранг №5',
];

// Местность для категорирования пожара
export const AREA_TYPES = [
    { value: 'urban', label: 'Город' },
    { value: 'rural', label: 'Сельская местность' },
];
export const AREA_TYPE_LABEL = (v) =>
    (AREA_TYPES.find((a) => a.value === v) || {}).label || '—';

export const CALL_STATUS_META = {
    processing: { label: 'Открытый', badge: 'bg-red-600 dark:bg-red-600/40' },
    report_preparation: { label: 'Подготовка отчёта', badge: 'bg-blue-600 dark:bg-blue-600/40' },
    closed: { label: 'Закрыт', badge: 'bg-slate-500 dark:bg-slate-500/40' },
};

// Возможные переходы статуса (для кнопок смены с подтверждением)
export const CALL_STATUS_TRANSITIONS = {
    processing: [
        { value: 'closed', label: 'Закрыть вызов', description: 'Вызов будет переведён в статус «Закрыт». Редактировать поля после этого смогут только пользователи с особым правом.' },
        { value: 'report_preparation', label: 'Подготовка отчёта', description: 'Вызов будет переведён в статус «Подготовка отчёта». Карточку по-прежнему можно редактировать.' },
    ],
    report_preparation: [
        { value: 'processing', label: 'Вернуть в работу', description: 'Вызов снова станет «Открытый».' },
        { value: 'closed', label: 'Закрыть вызов', description: 'Вызов будет переведён в статус «Закрыт». Редактировать поля после этого смогут только пользователи с особым правом.' },
    ],
    closed: [
        { value: 'processing', label: 'Вернуть в работу', description: 'Вызов снова станет «Открытый».' },
        { value: 'report_preparation', label: 'Подготовка отчёта', description: 'Вызов будет переведён в статус «Подготовка отчёта».' },
    ],
};

// ============================================================
// ХЕЛПЕРЫ ДАТ/ВРЕМЕНИ (datetime-local ↔ ISO)
// ============================================================
const pad = (n) => String(n).padStart(2, '0');

// Текущее локальное время в формате input[type=datetime-local]
export const nowLocalInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ISO (из БД) → локальная строка datetime-local
export const toLocalInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Локальная строка datetime-local → ISO (для отправки на сервер)
export const toIso = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

// Форматирование для отображения
export const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return format(d, 'dd.MM.yyyy HH:mm', { locale: ru });
};