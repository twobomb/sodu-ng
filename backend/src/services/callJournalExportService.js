const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const pool = require('../db/pool');

const TEMPLATE_PATH = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'templates',
    'template_call.xlsx'
);
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'fill_call_journal.py');

const pad = (n) => (n < 10 ? '0' : '') + n;

// Карточка вызова показывает даты/времена в локальном часовом поясе (UTC+3, ЛНР).
// postgres возвращает timestamptz как JS Date (UTC-мгновение). Чтобы вывести то же,
// что показывает карточка, сдвигаем на +3 ч и берём UTC-составляющие сдвинутой даты.
const OFFSET_MS = 3 * 3600 * 1000;

const toLocal = (ts) =>
    ts ? new Date(ts.getTime() + OFFSET_MS) : null;

const fmtDate = (d) =>
    d
        ? `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
        : '';

const fmtTime = (d) =>
    d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '';

const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : '');

// «YYYY-MM-DD» → граница (UTC) начала дня, или дня, следующего за указанным (для end)
const isoBoundary = (iso, end = false) => {
    const [y, m, d] = iso.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d + (end ? 1 : 0), 0, 0, 0);
    return new Date(utc - OFFSET_MS);
};

// Строка «YYYY-MM-DD» для локальной даты вызова (ключ группировки по дням)
const dayKey = (d) =>
    d
        ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
        : '';

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================
const loadCalls = async (startUtc, endUtc) => {
    const res = await pool.query(
        `SELECT c.id, c.message_received_at, c.address, c.description,
                c.type, c.rank,
                c.localization_at, c.open_fire_eliminated_at, c.fire_eliminated_at, c.first_barrel_at,
                c.fire_extinguishing_means
         FROM calls c
         WHERE c.message_received_at >= $1 AND c.message_received_at < $2
         ORDER BY c.message_received_at ASC`,
        [startUtc, endUtc]
    );
    return res.rows;
};

const loadUnits = async (callIds) => {
    if (!callIds.length) return {};
    const res = await pool.query(
        `SELECT cu.call_id, cu.dispatch_at, cu.arrival_at, cu.return_at,
                d.name AS department_name, t.short_name AS type_short_name
         FROM call_units cu
         JOIN units u ON cu.unit_id = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN unit_types t ON u.type_id = t.id
         WHERE cu.call_id = ANY($1::uuid[])
         ORDER BY cu.call_id, cu.dispatch_at ASC, d.name ASC, t.short_name ASC`,
        [callIds]
    );
    const byCall = {};
    for (const r of res.rows) {
        if (!byCall[r.call_id]) byCall[r.call_id] = [];
        byCall[r.call_id].push(r);
    }
    return byCall;
};

const loadEvents = async (callIds) => {
    if (!callIds.length) return {};
    const res = await pool.query(
        `SELECT ce.call_id, ce.event_at, ce.text
         FROM call_events ce
         WHERE ce.call_id = ANY($1::uuid[])
         ORDER BY ce.call_id, ce.event_at ASC, ce.created_at ASC`,
        [callIds]
    );
    const byCall = {};
    for (const r of res.rows) {
        if (!byCall[r.call_id]) byCall[r.call_id] = [];
        byCall[r.call_id].push(r);
    }
    return byCall;
};

// Средства пожаротушения: [{name, qty, text}]
//  - тип «Иные» → выводим только text (слово «Иные» не печатаем);
//  - остальные → «название - количество» (если количество есть).
const formatMeans = (means) => {
    const rows = Array.isArray(means) ? means : [];
    const parts = [];
    for (const m of rows) {
        const name = String(m.name || '').trim();
        if (name === 'Иные') {
            const t = String(m.text || '').trim();
            if (t) parts.push(t);
        } else if (name) {
            const qty = m.qty;
            parts.push(qty == null || qty === '' ? name : `${name} - ${qty}`);
        }
    }
    return parts.join(';\n');
};

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ: построение тела журнала и запуск python/openpyxl
// ============================================================
const exportJournal = async ({
    date_from,
    date_to,
    sdal_zvanie = '',
    sdal_fio = '',
    prinyal_zvanie = '',
    prinyal_fio = '',
    proveril_zvanie = '',
    proveril_fio = '',
}) => {
    const startUtc = isoBoundary(date_from);
    const endUtc = isoBoundary(date_to, true);

    const calls = await loadCalls(startUtc, endUtc);

    // Нет ни одного вызова за выбранный период — выгружать нечего
    if (!calls.length) {
        return { empty: true, buffer: null, filename: '', ignored: [] };
    }

    const callIds = calls.map((c) => c.id);
    const unitsByCall = await loadUnits(callIds);
    const eventsByCall = await loadEvents(callIds);

    // Группировка по локальной дате вызова (как в карточке)
    const dayById = new Map();
    for (const call of calls) {
        const local = toLocal(call.message_received_at);
        const key = dayKey(local);
        if (!dayById.has(key)) {
            dayById.set(key, { key, date: fmtDate(local), calls: [] });
        }
        dayById.get(key).calls.push(call);
    }
    const days = [...dayById.values()].sort(
        (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );

    // Если дата совпадает с датой в колонке B (%ДАТА_ВЫЗОВА%), выводим только
    // часы и минуты (hh:mm), иначе — полную дату и время (dd.mm.yyyy hh:mm).
    const smart = (ts, callDate) => {
        if (!ts) return null;
        const d = toLocal(ts);
        if (fmtDate(d) === callDate) return fmtTime(d);
        return fmtDateTime(d);
    };

    const daysOut = days.map((day) => {
        day.calls.forEach((c, i) => (c.__num = i + 1));
        return {
            date: day.date,
            calls: day.calls.map((c) => {
                const local = toLocal(c.message_received_at);
                const callDate = fmtDate(local);
                const units = (unitsByCall[c.id] || []).map((u) => ({
                    name: [u.department_name, u.type_short_name].filter(Boolean).join(' '),
                    dispatch: smart(u.dispatch_at, callDate),
                    arrival: smart(u.arrival_at, callDate),
                    return: smart(u.return_at, callDate),
                }));
                const events = (eventsByCall[c.id] || []).map((e) => ({
                    at: smart(e.event_at, callDate),
                    text: e.text || '',
                }));
                const type =
                    (c.type || '') + (c.type === 'Пожар' && c.rank ? ` ${c.rank}` : '');
                return {
                    number: c.__num,
                    call_date: callDate,
                    time: fmtTime(local),
                    address: c.address || '',
                    description: c.description || '',
                    events,
                    type,
                    means: formatMeans(c.fire_extinguishing_means),
                    ops: {
                        barrel: smart(c.first_barrel_at, callDate),
                        localization: smart(c.localization_at, callDate),
                        open_fire: smart(c.open_fire_eliminated_at, callDate),
                        fire_elim: smart(c.fire_eliminated_at, callDate),
                    },
                    units,
                };
            }),
        };
    });

    const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dataPath = path.join(os.tmpdir(), `call_journal_${stamp}.json`);
    const outPath = path.join(os.tmpdir(), `call_journal_${stamp}.xlsx`);

    fs.writeFileSync(
        dataPath,
        JSON.stringify({
            footer: {
                sdal_zvanie,
                sdal_fio,
                prinyal_zvanie,
                prinyal_fio,
                proveril_zvanie,
                proveril_fio,
            },
            days: daysOut,
        })
    );

    try {
        execFileSync('python', [SCRIPT_PATH, TEMPLATE_PATH, dataPath, outPath], {
            stdio: 'ignore',
        });
        const buffer = fs.readFileSync(outPath);

        let filename;
        if (date_from === date_to) {
            const [y, m, d] = date_from.split('-');
            filename = `Журнал вызовов за ${d}.${m}.${y}.xlsx`;
        } else {
            const [y1, m1, d1] = date_from.split('-');
            const [y2, m2, d2] = date_to.split('-');
            filename = `Журнал вызовов с ${d1}.${m1}.${y1} по ${d2}.${m2}.${y2}.xlsx`;
        }

        return { buffer, filename, ignored: [] };
    } finally {
        if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }
};

module.exports = { exportJournal };