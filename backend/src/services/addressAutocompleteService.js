const path = require('path');

// ---------- Подключение к SQLite (встроенный модуль node:sqlite) ----------
// Дело встроенное, отдельная зависимость не нужна. Путь к БД настраивается
// через переменную окружения ADDRESS_DB_PATH, по умолчанию — backend/data/fias_94.db
const DB_PATH = process.env.ADDRESS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'fias_94.db');

let db = null;

function openDb() {
    try {
        const {DatabaseSync} = require('node:sqlite');
        const instance = new DatabaseSync(DB_PATH);
        instance.exec('PRAGMA cache_size = -20000;');
        instance.exec('PRAGMA temp_store = MEMORY;');
        // Автомиграция: заполняем нормализованные колонки, если их ещё нет
        ensureLowerColumns(instance);
        return instance;
    } catch (err) {
        // Файл БД отсутствует или модуль sqlite недоступен — сервис деградирует
        // до пустого ответа, не роняя весь сервер.
        console.error('[addressAutocomplete] Не удалось открыть БД: ' + err.message);
        return null;
    }
}

function isDbAvailable() {
    if (db) return true;
    db = openDb();
    return !!db;
}

// ---------- Нормализация ----------
function normalize(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[.,;:!?()"'`«»]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ---------- Автомиграция ----------
function ensureLowerColumns(instance) {
    let cols = instance.prepare('PRAGMA table_info(addrobj)').all().map((c) => c.name);
    let migrated = false;
    if (!cols.includes('name_lower')) {
        console.log('⚙  addressAutocomplete: addrobj.name_lower отсутствует — заполняю...');
        instance.exec('ALTER TABLE addrobj ADD COLUMN name_lower TEXT');
        const rows = instance.prepare('SELECT rowid AS rid, formalname FROM addrobj').all();
        const upd = instance.prepare('UPDATE addrobj SET name_lower=? WHERE rowid=?');
        for (const r of rows) upd.run(normalize(r.formalname), r.rid);
        instance.exec('CREATE INDEX IF NOT EXISTS idx_addrobj_name_lower ON addrobj(name_lower)');
        console.log(`   ✓ ${rows.length} строк addrobj`);
        migrated = true;
    }
    cols = instance.prepare('PRAGMA table_info(house)').all().map((c) => c.name);
    if (!cols.includes('number_lower')) {
        console.log('⚙  addressAutocomplete: house.number_lower отсутствует — заполняю...');
        instance.exec('ALTER TABLE house ADD COLUMN number_lower TEXT');
        const rows = instance.prepare('SELECT id, number FROM house').all();
        const upd = instance.prepare('UPDATE house SET number_lower=? WHERE id=?');
        for (const r of rows) upd.run(normalize(r.number), r.id);
        instance.exec('CREATE INDEX IF NOT EXISTS idx_house_number_lower ON house(number_lower)');
        console.log(`   ✓ ${rows.length} строк house`);
        migrated = true;
    }
    return migrated;
}

// ---------- Словарь ----------
const SHORT_CANON = {
    'р-н': 'р-н', 'район': 'р-н', 'р-он': 'р-н',
    'ул': 'ул', 'улица': 'ул',
    'пр': 'пр', 'проспект': 'пр', 'пр-кт': 'пр', 'просп': 'пр',
    'пер': 'пер', 'переулок': 'пер',
    'б-р': 'б-р', 'бульвар': 'б-р',
    'ш': 'ш', 'шоссе': 'ш',
    'пл': 'пл', 'площадь': 'пл',
    'наб': 'наб', 'набережная': 'наб',
    'туп': 'туп', 'тупик': 'туп',
    'проезд': 'проезд', 'пр-д': 'проезд',
    'аллея': 'аллея', 'тракт': 'тракт',
    'кв-л': 'кв-л', 'квартал': 'кв-л',
    'мкр': 'мкр', 'микрорайон': 'мкр',
    'г': 'г', 'город': 'г',
    'пгт': 'пгт',
    'пос': 'пос', 'поселок': 'пос', 'п': 'п',
    'с': 'с', 'село': 'с',
    'д': 'д', 'деревня': 'д',
    'ст': 'ст', 'станица': 'ст',
    'рп': 'рп',
    'х': 'х', 'хутор': 'х',
    'аул': 'аул',
    'сл': 'сл', 'слобода': 'сл',
    'обл': 'обл', 'область': 'обл',
    'край': 'край',
    'респ': 'респ', 'республика': 'респ',
    'ао': 'ао', 'округ': 'ао', 'автономный': 'ао',
    'тер': 'тер', 'территория': 'тер',
};

function canonShort(s) {
    const clean = String(s || '').toLowerCase().replace(/\./g, '').trim();
    return SHORT_CANON[clean] || clean || null;
}

// ---------- Токенизация ----------
function tokenize(input) {
    const raw = String(input || '');
    const norm = normalize(raw);
    if (!norm) return {items: [], significant: [], houseNumber: null, raw};

    const tokens = norm.split(' ').filter(Boolean);
    let houseNumber = null;
    if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        if (/^\d{1,4}[а-я]?$/i.test(last)) {
            houseNumber = last;
            tokens.pop();
        }
    }

    const items = [];
    let pendingType = null;
    for (const t of tokens) {
        const canon = SHORT_CANON[t];
        if (canon) {
            pendingType = canon;
        } else if (t.length >= 2) {
            items.push({type: pendingType, value: t});
            pendingType = null;
        }
    }

    return {
        items,
        significant: items.map((it) => it.value),
        houseNumber,
        raw,
    };
}

// ---------- SQL ----------
const stmtFindByName = () => db.prepare(`
    SELECT aoguid, parentguid, aolevel, formalname, shortname, name_lower
    FROM addrobj
    WHERE aolevel >= 1
      AND name_lower LIKE ? LIMIT 800
`);

const stmtFindByGuid = () => db.prepare(`
    SELECT aoguid, parentguid, aolevel, formalname, shortname, name_lower
    FROM addrobj
    WHERE aoguid = ?
`);

const stmtPath = () => db.prepare(`
    WITH RECURSIVE chain(aoguid, parentguid, formalname, shortname, aolevel, name_lower)
                       AS (SELECT aoguid, parentguid, formalname, shortname, aolevel, name_lower
                           FROM addrobj
                           WHERE aoguid = ?
                           UNION ALL
                           SELECT a.aoguid, a.parentguid, a.formalname, a.shortname, a.aolevel, a.name_lower
                           FROM addrobj a
                                    JOIN chain c ON a.aoguid = c.parentguid)
    SELECT formalname, shortname, aolevel, name_lower
    FROM chain
    ORDER BY aolevel ASC
`);

const stmtChildren = () => db.prepare(`
    SELECT aoguid, parentguid, aolevel, formalname, shortname, name_lower
    FROM addrobj
    WHERE parentguid = ?
    ORDER BY aolevel ASC, formalname ASC
`);

const stmtChildrenCount = () => db.prepare('SELECT COUNT(*) AS c FROM addrobj WHERE parentguid = ?');

const stmtHousesPrefix = () => db.prepare(`
    SELECT number, kind
    FROM house
    WHERE street_guid = ?
      AND number_lower LIKE ?
    ORDER BY length(number), number LIMIT 30
`);

const stmtHousesAll = () => db.prepare(`
    SELECT number, kind
    FROM house
    WHERE street_guid = ?
    ORDER BY length(number), number LIMIT 30
`);

// ---------- Кэш путей ----------
const pathCache = new Map();

function getPath(aoguid) {
    if (pathCache.has(aoguid)) return pathCache.get(aoguid);
    const p = stmtPath().all(aoguid).map((r) => ({
        formalname: r.formalname,
        shortname: r.shortname,
        aolevel: r.aolevel,
        name_lower: r.name_lower || normalize(r.formalname),
    }));
    pathCache.set(aoguid, p);
    return p;
}

// ---------- Оценка совпадения цепочки с токенами ----------
function pathScore(pathArr, tokens) {
    if (!tokens || !tokens.length) return 100;
    const words = pathArr.map((p) => p.name_lower).join(' ').split(/\s+/).filter(Boolean);
    let score = 0;
    for (const t of tokens) {
        if (words.includes(t)) score += 100;
        else if (words.some((w) => w.startsWith(t))) score += 50;
        else if (words.some((w) => w.includes(t))) score += 10;
        else return -1;
    }
    return score;
}

function formatPath(pathArr, extra, {showRegion = false} = {}) {
    const parts = showRegion ? pathArr : pathArr.filter((p) => p.aolevel > 2);
    const strs = parts.map((p) => `${p.shortname ? p.shortname + ' ' : ''}${p.formalname}`);
    if (extra) strs.push(extra);
    return strs.join(', ');
}

const KIND_LABEL = {house: 'д. ', building: 'корп. ', structure: 'стр. ', stead: ''};

function kindLabel(kind) {
    return KIND_LABEL[kind] || '';
}

function levelToType(lvl) {
    if (lvl === 7) return 'street';
    if (lvl === 65) return 'quarter';
    if (lvl >= 6) return 'settlement';
    if (lvl === 4) return 'city';
    if (lvl <= 2) return 'region';
    return 'object';
}

function scoreItem(item, tokens) {
    const name = item.name_lower || normalize(item.formalname);
    const joined = tokens.join(' ');
    let s = 0;
    if (name === joined) s += 300;
    else if (name.startsWith(joined)) s += 150;
    else if (name.includes(' ' + joined)) s += 60;
    else if (name.includes(joined)) s += 30;
    for (const t of tokens) {
        if (name === t) s += 40;
        else if (name.startsWith(t)) s += 20;
        else if (name.includes(' ' + t)) s += 10;
        else if (name.includes(t)) s += 3;
    }
    s -= Math.min(name.length * 0.2, 15);
    if (tokens.length === 1) {
        if (item.aolevel === 4) s += 15;
        else if (item.aolevel === 6) s += 8;
        else if (item.aolevel === 7) s += 5;
        else if (item.aolevel === 1) s += 3;
    } else {
        if (item.aolevel === 7) s += 20;
        else if (item.aolevel === 6) s += 10;
        else if (item.aolevel === 4) s += 5;
    }
    return s;
}

// ---------- Поиск по specific-токену ----------
function matchBySpecific(items, specificIndex, applyTypeFilter = true) {
    const specific = items[specificIndex].value;
    const typeFilter = applyTypeFilter ? items[specificIndex].type : null;
    const others = items.filter((_, i) => i !== specificIndex).map((it) => it.value);
    const candidates = stmtFindByName().all(`%${specific}%`);
    const out = [];
    for (const c of candidates) {
        if (typeFilter) {
            const cCanon = canonShort(c.shortname);
            if (cCanon !== typeFilter) continue;
        }
        const p = getPath(c.aoguid);
        const ps = pathScore(p, others);
        if (ps >= 0) out.push({...c, path: p, pathScore: ps});
    }
    return out;
}

// ---------- Резолв префикса в объект ----------
function resolveParentObject(prefixText) {
    const {items, significant} = tokenize(prefixText);
    if (!significant.length) return null;

    let matches = matchBySpecific(items, items.length - 1, true);
    if (!matches.length) matches = matchBySpecific(items, items.length - 1, false);
    if (!matches.length && items.length > 1) matches = matchBySpecific(items, 0, false);
    if (!matches.length) return null;

    matches.sort((a, b) => {
        if ((b.pathScore || 0) !== (a.pathScore || 0)) return (b.pathScore || 0) - (a.pathScore || 0);
        return (b.aolevel || 0) - (a.aolevel || 0);
    });

    return matches[0];
}

// ---------- Дети + дома ----------
function suggestChildren(parentAoguid, {query = '', limit = 10, showRegion = false, noFallback = false} = {}) {
    const all = stmtChildren().all(parentAoguid);
    const {significant, houseNumber} = tokenize(query);
    const numQuery = houseNumber || (/^\d{1,4}[а-я]?$/.test(normalize(query)) ? normalize(query) : null);

    let houses = [];
    if (numQuery) {
        houses = stmtHousesPrefix().all(parentAoguid, `${numQuery}%`);
    } else if (all.length === 0) {
        houses = stmtHousesAll().all(parentAoguid);
    }

    let children = all;
    if (significant.length) {
        children = all.filter((c) => significant.every((t) => (c.name_lower || '').includes(t)));
    }

    const results = [];
    const fmtOpts = {showRegion};

    for (const h of houses) {
        if (results.length >= limit) break;
        results.push({
            display: formatPath(getPath(parentAoguid), `${kindLabel(h.kind)}${h.number}`, fmtOpts),
            type: h.kind,
            aoguid: parentAoguid,
            street_guid: parentAoguid,
            house_number: h.number,
        });
    }
    for (const c of children) {
        if (results.length >= limit) break;
        results.push({
            display: formatPath(getPath(c.aoguid), null, fmtOpts),
            type: levelToType(c.aolevel),
            aoguid: c.aoguid,
            shortname: c.shortname,
        });
    }
    if (!results.length && significant.length && all.length && !noFallback) {
        for (const c of all) {
            if (results.length >= limit) break;
            results.push({
                display: formatPath(getPath(c.aoguid), null, fmtOpts),
                type: levelToType(c.aolevel),
                aoguid: c.aoguid,
                shortname: c.shortname,
            });
        }
    }
    return results;
}

function objectResult(aoguid, showRegion) {
    const obj = stmtFindByGuid().get(aoguid);
    if (!obj) return null;
    return {
        display: formatPath(getPath(aoguid), null, {showRegion}),
        type: levelToType(obj.aolevel),
        aoguid: aoguid,
        shortname: obj.shortname,
    };
}

function showContentOf(aoguid, {limit = 10, showRegion = false} = {}) {
    const count = stmtChildrenCount().get(aoguid).c;
    if (count > 0) return suggestChildren(aoguid, {query: '', limit, showRegion});
    const houses = stmtHousesAll().all(aoguid);
    if (houses.length) {
        const p = getPath(aoguid);
        return houses.slice(0, limit).map((h) => ({
            display: formatPath(p, `${kindLabel(h.kind)}${h.number}`, {showRegion}),
            type: h.kind,
            aoguid: aoguid,
            street_guid: aoguid,
            house_number: h.number,
        }));
    }
    return [];
}

// ---------- Иерархический режим ----------
function tryHierarchical(raw, opts) {
    const str = String(raw || '');
    const trailingSpace = /\s$/.test(str) && str.length > 1;
    const trimmed = str.replace(/\s+$/, '').trim();
    if (!trimmed) return null;

    // Приоритет 1: ввод заканчивается пробелом
    if (trailingSpace) {
        const parentAoguid = resolveParentObject(trimmed)?.aoguid;
        if (parentAoguid) {
            const content = showContentOf(parentAoguid, {
                limit: opts.limit, showRegion: opts.showRegion,
            });
            if (content.length) return content;
        }
    }

    // Приоритет 2: есть запятая
    const lastComma = trimmed.lastIndexOf(',');
    if (lastComma === -1) return null;

    const prefix = trimmed.slice(0, lastComma).trim();
    const tail = trimmed.slice(lastComma + 1).trim();
    if (!prefix) return null;

    const tailTokens = tail ? tail.split(/\s+/).filter(Boolean) : [];

    for (let i = tailTokens.length; i >= 0; i--) {
        const candidatePrefix = i > 0
            ? prefix + ', ' + tailTokens.slice(0, i).join(' ')
            : prefix;
        const query = tailTokens.slice(i).join(' ');

        const parentObj = resolveParentObject(candidatePrefix);
        if (!parentObj) continue;
        const parentAoguid = parentObj.aoguid;

        // ---- Весь хвост — часть пути ----
        if (i === tailTokens.length && tailTokens.length > 0) {
            const lastTok = tailTokens[tailTokens.length - 1];
            const isHouseNum = /^\d{1,4}[а-я]?$/i.test(lastTok);

            // Последнее слово — номер дома
            if (isHouseNum) {
                const numPrefix = normalize(lastTok);
                const houses = stmtHousesPrefix().all(parentAoguid, `${numPrefix}%`);
                const p = getPath(parentAoguid);
                return houses.slice(0, opts.limit).map((h) => ({
                    display: formatPath(p, `${kindLabel(h.kind)}${h.number}`, {showRegion: opts.showRegion}),
                    type: h.kind,
                    aoguid: parentAoguid,
                    street_guid: parentAoguid,
                    house_number: h.number,
                }));
            }

            const lastWord = normalize(lastTok);
            const exact = parentObj.name_lower === lastWord;

            if (exact) {
                const deeper = showContentOf(parentAoguid, {
                    limit: opts.limit, showRegion: opts.showRegion,
                });
                if (deeper.length) return deeper;
                const only = objectResult(parentAoguid, opts.showRegion);
                return only ? [only] : [];
            }

            // Имя неполное — сначала сам объект, потом содержимое
            const head = objectResult(parentAoguid, opts.showRegion);
            const rest = opts.limit - 1;
            const content = rest > 0
                ? showContentOf(parentAoguid, {limit: rest, showRegion: opts.showRegion})
                : [];
            return head ? [head, ...content] : content;
        }

        // ---- Часть хвоста — запрос по детям ----
        const kids = suggestChildren(parentAoguid, {
            query,
            limit: opts.limit,
            showRegion: opts.showRegion,
            noFallback: query !== '',
        });
        if (!kids.length) continue;

        if (query && kids.length === 1) {
            const obj = stmtFindByGuid().get(kids[0].aoguid);
            if (obj && obj.name_lower === normalize(query)) {
                const deeper = suggestChildren(kids[0].aoguid, {
                    query: '', limit: opts.limit, showRegion: opts.showRegion,
                });
                if (deeper.length) return deeper;
            }
        }
        return kids;
    }
    return null;
}

// ---------- Главная функция ----------
function autocomplete(input, {limit = 10, showRegion = false} = {}) {
    if (!isDbAvailable()) return [];

    const raw = String(input || '');
    if (!raw.replace(/\s/g, '')) return [];

    const hierarchical = tryHierarchical(raw, {limit, showRegion});
    if (hierarchical !== null && hierarchical.length) return hierarchical;

    // --- Обычный режим ---
    const {items, significant, houseNumber} = tokenize(raw);
    if (!significant.length) return [];

    let matched = matchBySpecific(items, items.length - 1, true);
    if (!matched.length) matched = matchBySpecific(items, items.length - 1, false);
    if (!matched.length && items.length > 1) matched = matchBySpecific(items, 0, false);
    if (!matched.length) return [];

    const byId = new Map();
    for (const m of matched) {
        const s = scoreItem(m, significant) + (m.pathScore || 0);
        const prev = byId.get(m.aoguid);
        if (!prev || s > prev.score) byId.set(m.aoguid, {...m, score: s});
    }
    const sorted = [...byId.values()].sort((a, b) => b.score - a.score);

    const fmtOpts = {showRegion};
    const results = [];
    const seen = new Set();

    for (const m of sorted) {
        if (results.length >= limit) break;

        if (houseNumber) {
            const houses = stmtHousesPrefix().all(m.aoguid, `${houseNumber}%`);
            if (houses.length) {
                for (const h of houses.slice(0, 3)) {
                    if (results.length >= limit) break;
                    results.push({
                        display: formatPath(m.path, `${kindLabel(h.kind)}${h.number}`, fmtOpts),
                        type: h.kind,
                        aoguid: m.aoguid,
                        street_guid: m.aoguid,
                        house_number: h.number,
                    });
                }
                continue;
            }
        }
        if (seen.has(m.aoguid)) continue;
        seen.add(m.aoguid);
        results.push({
            display: formatPath(m.path, null, fmtOpts),
            type: levelToType(m.aolevel),
            aoguid: m.aoguid,
            shortname: m.shortname,
        });
    }
    return results;
}

module.exports = {autocomplete, tokenize, normalize};