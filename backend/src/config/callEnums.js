/**
 * Общие перечисления вызовов.
 * Используются сервисами вызовов и построителем запросов выборки,
 * чтобы не дублировать списки в разных модулях.
 */
const CALL_TYPES = [
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

const CALL_RANKS = [
    'Ранг №1',
    'Ранг №1-БИС',
    'Ранг №2',
    'Ранг №3',
    'Ранг №4',
    'Ранг №5',
];

const CALL_STATUSES = ['processing', 'closed', 'error'];

// Местность (категорирование пожара)
const AREA_TYPES = [
    { value: 'urban', label: 'Город' },
    { value: 'rural', label: 'Сельская местность' },
];

module.exports = { CALL_TYPES, CALL_RANKS, CALL_STATUSES, AREA_TYPES };
