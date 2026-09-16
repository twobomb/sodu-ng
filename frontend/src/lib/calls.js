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
    'ПСП',
    'ПТУ',
    'Хоз. Работы',
];

export const CALL_RANKS = [
    'Ранг №1',
    'Ранг №1-БИС',
    'Ранг №2',
    'Ранг №3',
    'Ранг №4',
    'Ранг №5',
];

export const CALL_STATUS_META = {
    processing: { label: 'Обрабатывается', badge: 'bg-blue-500' },
    closed: { label: 'Закрыт', badge: 'bg-green-600' },
    error: { label: 'Ошибочный', badge: 'bg-red-600' },
};

// Возможные переходы статуса (для кнопок смены с подтверждением)
export const CALL_STATUS_TRANSITIONS = {
    processing: [
        { value: 'closed', label: 'Закрыть вызов', description: 'Вызов будет переведён в статус «Закрыт». Редактировать поля после этого смогут только пользователи с особым правом.' },
        { value: 'error', label: 'Ошибочный', description: 'Вызов будет помечен как «Ошибочный» и больше нигде не будет учитываться (аналог удаления).' },
    ],
    closed: [
        { value: 'processing', label: 'Вернуть в обработку', description: 'Вызов снова станет «Обрабатывается».' },
        { value: 'error', label: 'Ошибочный', description: 'Вызов будет помечен как «Ошибочный» и больше нигде не будет учитываться (аналог удаления).' },
    ],
    error: [
        { value: 'processing', label: 'Вернуть в обработку', description: 'Вызов снова станет «Обрабатывается».' },
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