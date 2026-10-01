const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const pool = require('../db/pool');
const { CALL_TYPES } = require('../config/callEnums');

const TEMPLATE_PATH = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'templates',
    'daily_statement.xls'
);
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'fill_daily_statement.py');

const pad = (n) => (n < 10 ? '0' : '') + n;

// Карточка вызова показывает даты/времена в локальном часовом поясе (UTC+3, ЛНР).
// postgres возвращает timestamptz как JS Date (UTC-мгновение). Чтобы вывести то же,
// что показывает карточка, сдвигаем на +3 ч и берём UTC-составляющие сдвинутой даты.
const OFFSET_MS = 3 * 3600 * 1000;

const toLocal = (ts) => (ts ? new Date(ts.getTime() + OFFSET_MS) : null);

const fmtDate = (d) =>
    d
        ? `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
        : '';

const fmtTime = (d) => (d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '');

const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : '');

// «YYYY-MM-DD» → граница (UTC) начала дня или дня, следующего за указанным (end)
const isoBoundary = (iso, end = false) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + (end ? 1 : 0), 0, 0, 0) - OFFSET_MS);
};

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================
const loadCalls = async (startUtc, endUtc) => {
    const res = await pool.query(
        `SELECT c.id, c.message_received_at, c.address, c.object_name, c.description,
                c.type, c.false_call, c.not_accounted_fire,
                c.localization_at, c.fire_eliminated_at, c.fire_extinguishing_means
         FROM calls c
         WHERE c.message_received_at >= $1 AND c.message_received_at < $2
           AND c.status <> 'error'
         ORDER BY c.message_received_at ASC`,
        [startUtc, endUtc]
    );
    return res.rows;
};

// Тип техники по вызову: { short_name: количество }
const loadUnitTypeCounts = async (callIds) => {
    if (!callIds.length) return {};
    const res = await pool.query(
        `SELECT cu.call_id, t.short_name
         FROM call_units cu
         JOIN units u ON cu.unit_id = u.id
         LEFT JOIN unit_types t ON u.type_id = t.id
         WHERE cu.call_id = ANY($1::uuid[])`,
        [callIds]
    );
    const byCall = {};
    for (const r of res.rows) {
        const name = String(r.short_name || '').trim();
        if (!name) continue;
        if (!byCall[r.call_id]) byCall[r.call_id] = {};
        byCall[r.call_id][name] = (byCall[r.call_id][name] || 0) + 1;
    }
    return byCall;
};

// Средства пожаротушения: [{name, qty, text}] → список строк
const formatMeansLines = (means) => {
    const rows = Array.isArray(means) ? means : [];
    const out = [];
    for (const m of rows) {
        const name = String(m.name || '').trim();
        if (name === 'Иные') {
            const t = String(m.text || '').trim();
            if (t) out.push(t);
        } else if (name) {
            const qty = m.qty;
            out.push(qty == null || qty === '' ? name : `${name} - ${qty}`);
        }
    }
    return out;
};

// Колонка F: средства тушения + задействованные типы техники «АЦ:4» (каждое на строке)
const formatForces = (means, typeCounts) => {
    const lines = formatMeansLines(means);
    const counts = typeCounts || {};
    Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
        .forEach((t) => lines.push(`${t}:${counts[t]}`));
    return lines.join('\n');
};

// Порядок типов — как в справочнике; неизвестные — в конец
const typeOrder = (t) => {
    const i = CALL_TYPES.indexOf(t);
    return i === -1 ? CALL_TYPES.length : i;
};

// Группировка вызовов. Каждый вызов попадает ровно в одну группу:
//   1) not_accounted_fire → «Пожаров, не подлежащих учету» (только сюда);
//   2) false_call         → «Ложный <Тип>»;
//   3) иначе              → группа по типу.
const buildGroups = (calls) => {
    const normalByType = new Map();
    const falseByType = new Map();
    const nonAccounted = [];

    for (const c of calls) {
        if (c.not_accounted_fire) {
            nonAccounted.push(c);
            continue;
        }
        const type = c.type || 'Без типа';
        const map = c.false_call ? falseByType : normalByType;
        if (!map.has(type)) map.set(type, []);
        map.get(type).push(c);
    }

    const groups = [];
    const pushByType = (map, prefix) => {
        [...map.keys()]
            .sort((a, b) => typeOrder(a) - typeOrder(b) || String(a).localeCompare(String(b)))
            .forEach((type) => {
                const list = map.get(type);
                groups.push({ title: `${prefix}${type}: ${list.length}`, calls: list });
            });
    };
    pushByType(normalByType, '');
    pushByType(falseByType, 'Ложный ');
    if (nonAccounted.length) {
        groups.push({
            title: `Пожаров, не подлежащих учету: ${nonAccounted.length}`,
            calls: nonAccounted,
        });
    }
    return groups;
};


// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ: сбор данных и запуск python/xlwt
// ============================================================
const exportStatement = async ({ date, dolzhnost = '', zvanie = '', fio = '' }) => {
    const startUtc = isoBoundary(date);
    const endUtc = isoBoundary(date, true);

    const calls = await loadCalls(startUtc, endUtc);
    const callIds = calls.map((c) => c.id);
    const unitsByCall = await loadUnitTypeCounts(callIds);

    const groups = buildGroups(calls).map((g) => ({
        title: g.title,
        calls: g.calls.map((c, i) => {
            const local = toLocal(c.message_received_at);
            const addr = c.address || '';
            const obj = String(c.object_name || '').trim();
            return {
                number: i + 1,
                date: fmtDate(local),
                time: fmtTime(local),
                addr_ob: obj ? `${addr}\n${obj}` : addr,
                description: c.description || '',
                forces: formatForces(c.fire_extinguishing_means, unitsByCall[c.id]),
                localization: fmtDateTime(toLocal(c.localization_at)),
                liquidation: fmtDateTime(toLocal(c.fire_eliminated_at)),
            };
        }),
    }));

    const [yy, mm, dd] = date.split('-');
    const dateRu = `${dd}.${mm}.${yy}`;

    const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dataPath = path.join(os.tmpdir(), `daily_statement_${stamp}.json`);
    const outPath = path.join(os.tmpdir(), `daily_statement_${stamp}.xls`);

    fs.writeFileSync(
        dataPath,
        JSON.stringify({
            date: dateRu,
            footer: { dolzhnost, zvanie, fio },
            groups,
        })
    );

    try {
        execFileSync('python', [SCRIPT_PATH, TEMPLATE_PATH, dataPath, outPath], {
            stdio: 'ignore',
        });
        const buffer = fs.readFileSync(outPath);
        const filename = `Суточная ведомость за ${dateRu}.xls`;
        return { buffer, filename, total: calls.length };
    } finally {
        if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }
};

module.exports = { exportStatement };

