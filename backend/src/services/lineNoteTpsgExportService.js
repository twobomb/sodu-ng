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
    'template_tpsg.xlsx'
);
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'fill_tpsg.py');

const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
};

// Русская дата ДД.ММ.ГГГГ для %ТЕК_ДАТА%
const toRuDate = (iso) => {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
};
// ============================================================
// ДАННЫЕ ДЛЯ ВЫГРУЗКИ
// ============================================================
const loadDepartments = async () => {
    const res = await pool.query(
        `SELECT d.id, d.name AS short_name, d.parent_id, d.sort_order,
                d.garrison_id, g.name AS garrison_name, g.sort_order AS garrison_order,
                d.department_type_id, dt.name AS department_type_name,
                d.show_in_line_note
         FROM departments d
         LEFT JOIN garrisons g ON d.garrison_id = g.id
         LEFT JOIN department_types dt ON d.department_type_id = dt.id
         WHERE d.show_in_line_note = true
         ORDER BY g.sort_order ASC, g.name ASC,
                  d.parent_id NULLS FIRST, d.sort_order ASC, d.name ASC`
    );
    return res.rows;
};

const loadNotes = async (date, departmentIds) => {
    if (!departmentIds.length) return {};
    const res = await pool.query(
        `SELECT department_id, status, data FROM line_notes WHERE note_date = $1 AND department_id = ANY($2::uuid[])`,
        [date, departmentIds]
    );
    const byDept = {};
    for (const r of res.rows) byDept[r.department_id] = { status: r.status, data: r.data || {} };
    return byDept;
};

// Колонки-итоги по категориям техники: [в расчете, в резерве, ТО/исправна, ремонт]
const TECH_CAT_COLS = {
    'Основная техника': [3, 4, 5, 6],
    'Специальная техника': [55, 56, 57, 58],
    'Вспомогательная техника': [99, 100, 101, 102],
    'Приспособленная и другая': [135, 136, 137, 138],
};

// ============================================================
// Значения одной строки подразделения: { column -> number }
// ============================================================
const computeValues = (data) => {
    data = data || {};
    const v = {};

    // --- Техника: суммируем по категориям (по типам не разбиваем) ---
    const technique = Array.isArray(data.technique) ? data.technique : [];
    for (const t of technique) {
        const cat = String(t.category || '').trim();
        const cols = TECH_CAT_COLS[cat];
        if (cols) {
            v[cols[0]] = (v[cols[0]] || 0) + num(t.in_calc);
            v[cols[1]] = (v[cols[1]] || 0) + num(t.second);
            v[cols[2]] = (v[cols[2]] || 0) + num(t.maintenance);
            v[cols[3]] = (v[cols[3]] || 0) + num(t.repair);
        } else if (cat === 'Пожарный поезд') {
            v[155] = (v[155] || 0) + num(t.in_calc);
            v[156] = (v[156] || 0) + num(t.second);
        }
    }

    // --- Огнетушащие вещества (возимые / в резерве) ---
    const ex = data.extinguishing || {};
    v[157] = num(ex.on_vehicle && ex.on_vehicle.foam);
    v[158] = num(ex.on_vehicle && ex.on_vehicle.powder);
    v[159] = num(ex.reserve && ex.reserve.foam);
    v[160] = num(ex.reserve && ex.reserve.powder);

    const p = data.personnel || {};
    const s = p.sizod || {};

    // --- СИЗОД (FE=161 «в расчете» = ДАСВ+ДАСК; FF=162 «в резерве» = ДАСВ+ДАСК) ---
    v[161] = num(s.dasv && s.dasv.calc) + num(s.dask && s.dask.calc);
    v[162] = num(s.dasv && s.dasv.reserve) + num(s.dask && s.dask.reserve);

    // --- Защитные костюмы ---
    v[167] = num(s.suits && s.suits.l1);
    v[168] = num(s.suits && s.suits.tok);
    v[169] = num(s.suits && s.suits.other);

    // --- ГАСИ ---
    v[170] = num(s.gasi && s.gasi.calc);
    v[171] = num(s.gasi && s.gasi.reserve);

    // --- Личный состав ---
    v[172] = num(p.list);
    v[173] = num(p.present);
// Дежурный караул
    const g = p.guard || {};
    const GUARD = {
        175: 'chief',
        176: 'assistant',
        177: 'commander',
        178: 'driver',
        179: 'fireman',
        180: 'gas_protection',
        181: 'rescuer',
        182: 'cynologist',
        183: 'diver',
        184: 'medical',
        185: 'dispatcher',
    };
    let guardSum = 0;
    for (const col of Object.keys(GUARD)) {
        const val = num(g[GUARD[col]]);
        v[Number(col)] = val;
        guardSum += val;
    }
    v[174] = guardSum;

    // Отсутствует
    const a = p.absent || {};
    v[186] = num(a.vacation) + num(a.sick) + num(a.trip) + num(a.other);
    v[187] = num(a.vacation);
    v[188] = num(a.sick);
    v[189] = num(a.trip);
    v[190] = num(a.other);

    // --- СПТ/ЦППС ---
    const cgps = (p.cgps || []).reduce((m, c) => {
        m[String(c.name || '').trim().toLowerCase()] = c;
        return m;
    }, {});
    const terr = cgps['территориальная спт'];
    const mest = cgps['местные спт'];
    const cppc = cgps['цппс'];
    v[191] = num(terr && terr.created);
    v[192] = num(mest && mest.created);
    v[193] = num(cppc && cppc.created);
    v[194] = num(terr && terr.list);
    v[195] = num(terr && terr.present);
    v[196] = num(mest && mest.list);
    v[197] = num(mest && mest.present);
    v[198] = num(cppc && cppc.list);
    v[199] = num(cppc && cppc.present);

    return v;
};

// Поэлементное сложение двух карт значений
const addInto = (sum, vals) => {
    for (const k of Object.keys(vals)) {
        sum[Number(k)] = (sum[Number(k)] || 0) + num(vals[k]);
    }
    return sum;
};
// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ: ВЫГРУЗКА ТПСГ (данные -> python/openpyxl -> xlsx)
// ============================================================
const exportLineNotes = async ({ date, officers = {} }) => {
    const departments = await loadDepartments();
    const notes = await loadNotes(date, departments.map((d) => d.id));

    // Группируем по гарнизонам (только подразделения со включённым флагом)
    const groups = [];
    let cur = null;
    for (const d of departments) {
        if (!d.garrison_id || !d.garrison_name) continue;
        if (!cur || cur.id !== d.garrison_id) {
            cur = { id: d.garrison_id, name: d.garrison_name, depts: [] };
            groups.push(cur);
        }
        cur.depts.push(d);
    }

    // Строки данных
    const dataRows = []; // { type, text, col2, values }
    const grand = {};
    for (const g of groups) {
        dataRows.push({ type: 'garrison', text: g.name, values: {} });
        const sub = {};
        for (const d of g.depts) {
            const note = notes[d.id];
            const approved = !!(note && note.status === 'approved');
            // не утверждена (нет записи или черновик) — значения не выводим (пусто) и красим красным
            const vals = approved ? computeValues(note.data) : {};
            dataRows.push({
                type: 'dept',
                text: d.short_name || d.name,
                col2: d.department_type_name,
                values: vals,
                red: !approved,
            });
            if (approved) {
                addInto(sub, vals);
                addInto(grand, vals);
            }
        }
        dataRows.push({ type: 'subtotal', text: `Итого за ${g.name}`, values: sub });
    }
    dataRows.push({
        type: 'grand',
        text: 'Итого за ТПСГ Луганской Народной Республике',
        values: grand,
    });

    const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dataPath = path.join(os.tmpdir(), `tpsg_export_${stamp}.json`);
    const outPath = path.join(os.tmpdir(), `tpsg_export_${stamp}.xlsx`);

    fs.writeFileSync(
        dataPath,
        JSON.stringify({
            date: toRuDate(date),
            officers,
            data_rows: dataRows,
        })
    );
    try {
        execFileSync('python', [SCRIPT_PATH, TEMPLATE_PATH, dataPath, outPath], {
            stdio: 'ignore',
        });
        const buffer = fs.readFileSync(outPath);
        return {
            buffer,
            filename: `Строевая ТПСГ за ${toRuDate(date)}.xlsx`,
            ignored: [],
        };
    } finally {
        if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }
};

module.exports = { exportLineNotes };