/**
 * Построитель SELECT-условий для «Выборки вызовов».
 *
 * Определение запроса (JSON) собирается фронтендом и приходит на сервер:
 *   {
 *     items: [
 *       { kind: 'cond',  join: 'AND', negate: false, field: 'type', op: 'eq', value: 'Пожар' },
 *       { kind: 'group', join: 'OR',  negate: true,  items: [ ... ] }
 *     ]
 *   }
 *
 * Безопасность:
 *  - имена полей и операторов берутся ТОЛЬКО из белого списка (FIELD_MAP / OP_KINDS);
 *  - все значения подставляются исключительно через параметры ($1, $2, ...);
 *  - глубина вложенности и общее число условий ограничены.
 */
const { CALL_TYPES, CALL_RANKS, AREA_TYPES } = require('../config/callEnums');

class QueryBuildError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QueryBuildError';
        this.status = 400;
    }
}

const MAX_ITEMS = 200;
const MAX_DEPTH = 6;
const MAX_IN_LIST = 500;

// ============================================================
// ОПЕРАТОРЫ
// ============================================================
const OP_KINDS = {
    eq: { label: '=', kind: 'binary', sql: '=' },
    neq: { label: '≠', kind: 'binary', sql: '<>' },
    gt: { label: '>', kind: 'binary', sql: '>' },
    gte: { label: '≥', kind: 'binary', sql: '>=' },
    lt: { label: '<', kind: 'binary', sql: '<' },
    lte: { label: '≤', kind: 'binary', sql: '<=' },
    contains: { label: 'содержит', kind: 'like' },
    not_contains: { label: 'не содержит', kind: 'not_like' },
    starts_with: { label: 'начинается с', kind: 'starts_with' },
    in: { label: 'в списке', kind: 'in' },
    not_in: { label: 'не в списке', kind: 'not_in' },
    is_null: { label: 'не заполнено', kind: 'is_null' },
    is_not_null: { label: 'заполнено', kind: 'is_not_null' },
    between: { label: 'в диапазоне', kind: 'between' },
};

const OPS_BY_TYPE = {
    text: ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'in', 'not_in', 'is_null', 'is_not_null'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
    date: ['gte', 'lte', 'gt', 'lt', 'eq', 'between', 'is_null', 'is_not_null'],
    enum: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null'],
    ref: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null'],
    boolean: ['eq', 'is_null', 'is_not_null'],
    means_qty: ['eq', 'gt', 'gte', 'lt', 'lte'],
};

// Значения справочника «Средства пожаротушения» (совпадают с карточкой вызова)
const FIRE_MEANS_NAMES = [
    'Хлопушки',
    'РП-18',
    'Ств. "Б"',
    'Ств. "А"',
    'Лафетный ствол',
    'СВП',
    'Иные',
];

// ============================================================
// КАТАЛОГ ПОЛЕЙ
// ============================================================
const GROUP_GENERAL = 'Общая информация';
const GROUP_UNITS = 'Привлекаемая техника';
const GROUP_STAFF = 'Привлекаемый личный состав';
const GROUP_RTP = 'Руководители тушения пожара';
const GROUP_TACTICS = 'Оперативно-тактическая обстановка и объекты пожара';
const GROUP_MEANS = 'Средства пожаротушения';
const GROUP_CATEGORY = 'Категорирование пожара';
const GROUP_CAUSE = 'Причина пожара';
const GROUP_NONACCOUNT = 'Пожар не подлежит учёту';
const GROUP_VICTIMS = 'Пострадавшие';

// Поле-колонка напрямую из таблицы calls
const col = (key, label, group, type, sql, extra = {}) => ({
    key, label, group, type, sql, ...extra,
});
// Поле-ссылка на справочник (uuid-колонка). Приводим к text — тогда все значения
// (строки/uuid из справочников) сравниваются единообразно.
const refField = (key, label, group, ref, sql) => ({
    key, label, group, type: 'ref', ref, sql: `${sql}::text`,
});
// Поле внутри JSONB-массива: EXISTS (SELECT 1 FROM jsonb_array_elements(...) el WHERE el->>'x' ...)
const jsonbField = (key, label, group, arraySql, valueSql, type = 'text', ref = null) => ({
    key, label, group, type,
    jsonb: { array: arraySql, value: valueSql },
    ...(ref ? { ref } : {}),
});
// Поле «существует связанная строка» (привлекаемая техника через call_units).
// Тип поля — 'ref' (селект по справочнику), значение приводим к text для сравнения с uuid.
const existsField = (key, label, group, ref, from, where, value) => ({
    key, label, group, type: 'ref', ref,
    exists: { from, where, value: `${value}::text`, type: 'text' },
});

const FIELD_LIST = [
    // ---- Общая информация ----
    { key: 'type', label: 'Тип вызова', group: GROUP_GENERAL, type: 'enum', options: CALL_TYPES.map((t) => ({ value: t, label: t })), sql: 'c.type' },
    col('incident_at', 'Дата и время возникновения события', GROUP_GENERAL, 'date', 'c.incident_at'),
    col('message_received_at', 'Время получения сообщения', GROUP_GENERAL, 'date', 'c.message_received_at'),
    refField('municipality_id', 'Муниципальный / городской округ', GROUP_GENERAL, 'municipalities', 'c.municipality_id'),
    col('address', 'Адрес места происшествия', GROUP_GENERAL, 'text', 'c.address'),
    col('dispatch_at', 'Время высылки сил и средств', GROUP_GENERAL, 'date', 'c.dispatch_at'),
    col('arrival_at', 'Время прибытия', GROUP_GENERAL, 'date', 'c.arrival_at'),
    col('description', 'Описание', GROUP_GENERAL, 'text', 'c.description'),
    col('created_at', 'Дата создания карточки в системе', GROUP_GENERAL, 'date', 'c.created_at'),

    // ---- Привлекаемая техника ----
    existsField('unit_id', 'Привлекалась техника', GROUP_UNITS, 'units',
        'call_units cu JOIN units u ON u.id = cu.unit_id', 'cu.call_id = c.id', 'cu.unit_id'),
    existsField('unit_department_id', 'Подразделение привлекаемой техники', GROUP_UNITS, 'departments',
        'call_units cu JOIN units u ON u.id = cu.unit_id', 'cu.call_id = c.id', 'u.department_id'),
    existsField('unit_type_id', 'Тип привлекаемой техники', GROUP_UNITS, 'unit_types',
        'call_units cu JOIN units u ON u.id = cu.unit_id', 'cu.call_id = c.id', 'u.type_id'),

    // ---- Привлекаемый личный состав ----
    jsonbField('staff_department_id', 'Подразделение привлекаемого л/с', GROUP_STAFF,
        'c.involved_staff', "el->>'department_id'", 'ref', 'departments'),
    jsonbField('staff_name', 'Наименование л/с (произвольное)', GROUP_STAFF,
        'c.involved_staff', "el->>'name'", 'text'),
    col('staff_total', 'Общее количество привлечённого л/с, чел.', GROUP_STAFF, 'number',
        "COALESCE((SELECT SUM(NULLIF(el->>'count', '')::numeric) FROM jsonb_array_elements(COALESCE(c.involved_staff, '[]'::jsonb)) el), 0)"),

    // ---- Руководители тушения пожара ----
    jsonbField('rtp_fio', 'ФИО руководителя тушения пожара (РТП)', GROUP_RTP,
        'c.fire_leaders', "el->>'fio'", 'text'),
    jsonbField('rtp_position', 'Должность РТП', GROUP_RTP,
        'c.fire_leaders', "el->>'position'", 'text'),

    // ---- Оперативно-тактическая обстановка и объекты пожара ----
    { key: 'rank', label: 'Ранг вызова', group: GROUP_TACTICS, type: 'enum', options: CALL_RANKS.map((r) => ({ value: r, label: r })), sql: 'c.rank' },
    col('fire_area', 'Площадь пожара, м²', GROUP_TACTICS, 'number', 'c.fire_area'),
    col('first_barrel_at', 'Подача 1-го ствола', GROUP_TACTICS, 'date', 'c.first_barrel_at'),
    col('localization_at', 'Локализация пожара', GROUP_TACTICS, 'date', 'c.localization_at'),
    col('open_fire_eliminated_at', 'Ликвидация открытого горения', GROUP_TACTICS, 'date', 'c.open_fire_eliminated_at'),
    col('fire_eliminated_at', 'Ликвидация пожара', GROUP_TACTICS, 'date', 'c.fire_eliminated_at'),
    { key: 'carryover_fire', label: 'Переходящий пожар', group: GROUP_TACTICS, type: 'boolean', sql: 'c.carryover_fire' },

    // ---- Средства пожаротушения ----
    // Название средства — селект по предустановленному перечню средств
    {
        key: 'means_name',
        label: 'Название средства пожаротушения',
        group: GROUP_MEANS,
        type: 'enum',
        options: FIRE_MEANS_NAMES.map((n) => ({ value: n, label: n })),
        jsonb: { array: 'c.fire_extinguishing_means', value: "el->>'name'" },
    },
    {
        key: 'means_qty',
        label: 'Количество средства пожаротушения',
        group: GROUP_MEANS,
        type: 'means_qty',
        options: FIRE_MEANS_NAMES.map((n) => ({ value: n, label: n })),
    },

    // ---- Категорирование пожара ----
    { key: 'area_type', label: 'Местность', group: GROUP_CATEGORY, type: 'enum', options: AREA_TYPES, sql: 'c.area_type' },
    refField('fire_category_id', 'Категория пожара', GROUP_CATEGORY, 'fire_categories', 'c.fire_category_id'),

    // ---- Причина пожара ----
    refField('fire_cause_id', 'Причина пожара', GROUP_CAUSE, 'fire_causes', 'c.fire_cause_id'),
    col('fire_cause_other', 'Указанная причина (иные причины)', GROUP_CAUSE, 'text', 'c.fire_cause_other'),

    // ---- Пожар не подлежит учёту ----
    { key: 'not_accounted_fire', label: 'Пожар не подлежит учёту', group: GROUP_NONACCOUNT, type: 'boolean', sql: 'c.not_accounted_fire' },
    refField('not_accounted_reason_id', 'Причина неучёта пожара', GROUP_NONACCOUNT, 'fire_nonaccount', 'c.not_accounted_reason_id'),

    // ---- Пострадавшие ----
    col('victims_dead_total', 'Погибло людей, всего', GROUP_VICTIMS, 'number', 'c.victims_dead_total'),
    col('victims_dead_children', 'Погибло детей', GROUP_VICTIMS, 'number', 'c.victims_dead_children'),
    col('victims_injured_total', 'Травмировано людей, всего', GROUP_VICTIMS, 'number', 'c.victims_injured_total'),
    col('victims_injured_children', 'Травмировано детей', GROUP_VICTIMS, 'number', 'c.victims_injured_children'),
    col('victims_rescued_total', 'Спасено людей, всего', GROUP_VICTIMS, 'number', 'c.victims_rescued_total'),
    col('victims_rescued_children', 'Спасено детей', GROUP_VICTIMS, 'number', 'c.victims_rescued_children'),
    col('victims_evacuated_total', 'Эвакуировано людей, всего', GROUP_VICTIMS, 'number', 'c.victims_evacuated_total'),
    col('victims_evacuated_children', 'Эвакуировано детей', GROUP_VICTIMS, 'number', 'c.victims_evacuated_children'),
];

const FIELD_MAP = FIELD_LIST.reduce((acc, f) => {
    acc[f.key] = f;
    return acc;
}, {});

// Каталог полей для фронтенда (сгруппированный по блокам карточки вызова)
const FIELD_GROUPS_ORDER = [
    GROUP_GENERAL, GROUP_UNITS, GROUP_STAFF, GROUP_RTP, GROUP_TACTICS,
    GROUP_MEANS, GROUP_CATEGORY, GROUP_CAUSE, GROUP_NONACCOUNT, GROUP_VICTIMS,
];

const getFieldCatalog = () => ({
    groups: FIELD_GROUPS_ORDER.map((label) => ({
        label,
        fields: FIELD_LIST.filter((f) => f.group === label).map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            ref: f.ref || null,
            options: f.options || null,
            ops: OPS_BY_TYPE[f.type] || [],
        })),
    })).filter((g) => g.fields.length > 0),
    ops: OP_KINDS,
});

// ============================================================
// ПОСТРОЕНИЕ SQL
// ============================================================
const buildCtx = (offset = 0) => ({
    params: [],
    push(value) {
        this.params.push(value);
        return `$${offset + this.params.length}`;
    },
});

// Приведение значения к типу поля
const coerce = (type, value) => {
    if (value === undefined || value === null || value === '') return null;
    if (type === 'number') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    if (type === 'boolean') {
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
        return null;
    }
    return String(value);
};

const isEmptyValue = (type, value) => {
    if (value === undefined || value === null) return true;
    if (type === 'boolean') return value !== true && value !== false && value !== 'true' && value !== 'false';
    if (type === 'number') return String(value).trim() === '';
    return String(value).trim() === '';
};

// Условие для произвольного SQL-выражения (колонка или элемент JSONB)
const buildValueCondition = (expr, type, op, value, ctx) => {
    const kind = op.kind;

    if (kind === 'is_null') return `${expr} IS NULL`;
    if (kind === 'is_not_null') return `${expr} IS NOT NULL`;

    if (kind === 'in' || kind === 'not_in') {
        const raw = Array.isArray(value) ? value : [value];
        const list = raw
            .map((v) => coerce(type, v))
            .filter((v) => v !== null && v !== undefined && v !== '');
        if (list.length > MAX_IN_LIST) {
            throw new QueryBuildError(`Слишком много значений в списке (максимум ${MAX_IN_LIST})`);
        }
        if (!list.length) return kind === 'in' ? 'FALSE' : 'TRUE';
        const p = ctx.push(list);
        return `${expr} ${kind === 'in' ? '=' : '<>'} ANY(${p})`;
    }

    if (kind === 'between') {
        const from = coerce(type, value?.from);
        const to = coerce(type, value?.to);
        const parts = [];
        if (from !== null) parts.push(`${expr} >= ${ctx.push(from)}`);
        if (to !== null) parts.push(`${expr} <= ${ctx.push(to)}`);
        return parts.length ? parts.join(' AND ') : null;
    }

    if (kind === 'like' || kind === 'not_like') {
        if (isEmptyValue('text', value)) return null;
        const p = ctx.push(`%${String(value)}%`);
        return `${expr} ${kind === 'like' ? 'ILIKE' : 'NOT ILIKE'} ${p}`;
    }

    if (kind === 'starts_with') {
        if (isEmptyValue('text', value)) return null;
        const p = ctx.push(`${String(value)}%`);
        return `${expr} ILIKE ${p}`;
    }

    // Бинарные операторы (=, ≠, >, ≥, <, ≤)
    if (isEmptyValue(type, value)) return null;
    const p = ctx.push(coerce(type, value));
    return `${expr} ${op.sql} ${p}`;
};

// Специальное условие «Средство пожаротушения + количество»
// Значение: { name: 'Ств. "Б"', qty: 5 } → EXISTS(... AND qty > 5)
const buildMeansQty = (cond, ctx) => {
    const name = cond.value?.name;
    if (!name) return null;
    const opDef = OP_KINDS[cond.op];
    if (!opDef || opDef.kind !== 'binary') {
        throw new QueryBuildError('Для количества средства допустимы только операторы сравнения');
    }
    const qty = coerce('number', cond.value?.qty);
    if (qty === null) return null;
    const pName = ctx.push(String(name));
    const pQty = ctx.push(qty);
    return `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(c.fire_extinguishing_means, '[]'::jsonb)) el ` +
        `WHERE el->>'name' = ${pName} AND NULLIF(el->>'qty', '') IS NOT NULL ` +
        `AND (el->>'qty')::numeric ${opDef.sql} ${pQty})`;
};

// Одно условие
const buildCond = (cond, ctx) => {
    const def = FIELD_MAP[cond.field];
    if (!def) throw new QueryBuildError(`Неизвестное поле: ${cond.field}`);

    const meta = OP_KINDS[cond.op];
    if (!meta) throw new QueryBuildError(`Неизвестный оператор: ${cond.op}`);
    const op = { key: cond.op, ...meta };

    const allowed = OPS_BY_TYPE[def.type] || [];
    if (!allowed.includes(cond.op)) {
        throw new QueryBuildError(`Оператор «${meta.label}» неприменим к полю «${def.label}»`);
    }

    let sql = null;

    if (def.type === 'means_qty') {
        sql = buildMeansQty(cond, ctx);
    } else if (def.exists) {
        const inner = buildValueCondition(def.exists.value, def.exists.type, op, cond.value, ctx);
        if (inner) {
            sql = `EXISTS (SELECT 1 FROM ${def.exists.from} WHERE ${def.exists.where} AND ${inner})`;
        }
    } else if (def.jsonb) {
        const inner = buildValueCondition(def.jsonb.value, def.type, op, cond.value, ctx);
        if (inner) {
            sql = `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${def.jsonb.array}, '[]'::jsonb)) el WHERE ${inner})`;
        }
    } else {
        sql = buildValueCondition(def.sql, def.type, op, cond.value, ctx);
    }

    if (!sql) return null; // пустое условие просто игнорируем
    return `${cond.negate ? 'NOT ' : ''}(${sql})`;
};

// Условие или группа (рекурсивно)
const buildItem = (item, ctx, depth, counter) => {
    if (!item || typeof item !== 'object') return null;
    if (depth > MAX_DEPTH) throw new QueryBuildError('Слишком глубокая вложенность групп');

    counter.n += 1;
    if (counter.n > MAX_ITEMS) throw new QueryBuildError('Слишком много условий в запросе');

    if (item.kind === 'group') {
        const parts = [];
        const children = Array.isArray(item.items) ? item.items : [];
        for (const child of children) {
            const childSql = buildItem(child, ctx, depth + 1, counter);
            if (!childSql) continue;
            const join = child.join === 'OR' ? 'OR' : 'AND';
            parts.push(parts.length ? `${join} ${childSql}` : childSql);
        }
        if (!parts.length) return null;
        return `${item.negate ? 'NOT ' : ''}(${parts.join(' ')})`;
    }

    return buildCond(item, ctx);
};

/**
 * Собирает SQL-условие и параметры для определения выборки.
 * @param {object} definition — { items: [...] }
 * @param {number} offset — сколько параметров уже занято в вызывающем запросе
 * @returns {{ sql: string, params: any[] } | null}
 */
const buildSampleWhere = (definition, offset = 0) => {
    validateDefinition(definition);
    const ctx = buildCtx(offset);
    const counter = { n: 0 };
    const parts = [];

    for (const item of definition.items) {
        const sql = buildItem(item, ctx, 1, counter);
        if (!sql) continue;
        const join = item.join === 'OR' ? 'OR' : 'AND';
        parts.push(parts.length ? `${join} ${sql}` : sql);
    }

    if (!parts.length) return null;
    return { sql: parts.join(' '), params: ctx.params };
};

// Проверка структуры определения (без построения SQL)
const validateDefinition = (definition) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new QueryBuildError('Некорректное определение запроса');
    }
    if (!Array.isArray(definition.items)) {
        throw new QueryBuildError('Поле items должно быть массивом условий');
    }
    if (definition.items.length > MAX_ITEMS) {
        throw new QueryBuildError('Слишком много условий в запросе');
    }

    const walk = (items, depth) => {
        if (depth > MAX_DEPTH) throw new QueryBuildError('Слишком глубокая вложенность групп');
        for (const item of items) {
            if (!item || typeof item !== 'object') {
                throw new QueryBuildError('Некорректное условие в запросе');
            }
            if (item.kind === 'group') {
                if (item.items !== undefined && !Array.isArray(item.items)) {
                    throw new QueryBuildError('Список условий группы должен быть массивом');
                }
                walk(item.items || [], depth + 1);
            } else if (!item.field) {
                throw new QueryBuildError('У условия не указано поле');
            } else if (!FIELD_MAP[item.field]) {
                throw new QueryBuildError(`Неизвестное поле: ${item.field}`);
            }
        }
    };
    walk(definition.items, 1);
    return true;
};

module.exports = {
    QueryBuildError,
    buildSampleWhere,
    validateDefinition,
    getFieldCatalog,
};
