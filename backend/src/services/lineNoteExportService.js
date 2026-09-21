const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const pool = require('../db/pool');
const XLSX = require('xlsx');

const TEMPLATE_PATH = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'templates',
    'linenote_template.xls'
);
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'fill_linenote.py');

const num = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isNaN(n) ? '' : n;
};

// ============================================================
// КАРТА КОЛОНОК ТИПОВ ТЕХНИКИ ИЗ ШАБЛОНА (с учётом категории)
// Возвращает [{ category, label, col }]
// ============================================================
const readColumnMap = () => {
    const wb = XLSX.readFile(TEMPLATE_PATH);
    const ws = wb.Sheets['Лист1'] || wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true });
    const catRow = aoa[1] || [];
    const typesRow = aoa[2] || [];
    const CATEGORIES = [
        'Основная техника',
        'Специальная техника',
        'Вспомогательная техника',
        'Приспособленная и другая',
    ];

    // к какой категории относится каждая колонка
    const catAtCol = new Map();
    let cur = null;
    catRow.forEach((v, c) => {
        if (c >= 6 && v !== null && CATEGORIES.includes(String(v).trim())) cur = String(v).trim();
        if (cur) catAtCol.set(c, cur);
    });

    const entries = [];
    typesRow.forEach((v, c) => {
        if (c >= 6 && v !== null && String(v).trim() !== '') {
            let category = null;
            for (let i = c; i >= 6; i--) {
                if (catAtCol.has(i)) {
                    category = catAtCol.get(i);
                    break;
                }
            }
            // только реальные типы техники: зона 6..141
            // (СИЗОД 148+, ГАСИ 155+, СПТ 172+ и т.п. не входят)
            if (category && c >= 6 && c < 142) {
                entries.push({ category, label: String(v).trim(), col: c });
            }
        }
    });
    return entries;
};

const findTechnique = (technique, category, label) => {
    const qLabel = String(label).trim().toLowerCase();
    return technique.find((t) => {
        const sameCat = String(t.category || '').trim() === String(category).trim();
        const sameShort = String(t.short_name || '').trim().toLowerCase() === qLabel;
        const sameName = String(t.name || '').trim().toLowerCase() === qLabel;
        return sameCat && (sameShort || sameName);
    });
};

// ============================================================
// ПОДРАЗДЕЛЕНИЯ ДЛЯ ВЫГРУЗКИ (с гарнизоном и видом)
// ============================================================
const loadDepartments = async () => {
    const res = await pool.query(
        `SELECT d.id, d.name AS short_name,
                d.garrison_id, g.name AS garrison_name,
                d.department_type_id, dt.name AS department_type_name
         FROM departments d
         LEFT JOIN garrisons g ON d.garrison_id = g.id
         LEFT JOIN department_types dt ON d.department_type_id = dt.id
         ORDER BY g.sort_order ASC, d.sort_order ASC, d.name ASC`
    );
    const rows = [];
    const ignored = [];
    for (const d of res.rows) {
        if (!d.garrison_name || !d.department_type_name) {
            ignored.push(d.short_name || d.id);
            continue;
        }
        rows.push(d);
    }
    return { rows, ignored };
};

// ============================================================
// ДАННЫЕ СТРОЕВЫХ ЗАПИСОК НА ДАТУ
// ============================================================
const loadNotes = async (date, departmentIds) => {
    if (!departmentIds.length) return {};
    const res = await pool.query(
        `SELECT department_id, status, data
         FROM line_notes
         WHERE note_date = $1 AND department_id = ANY($2::uuid[])`,
        [date, departmentIds]
    );
    return res.rows.reduce((m, r) => {
        m[r.department_id] = r;
        return m;
    }, {});
};

// ============================================================
// СТРОКА ПОДРАЗДЕЛЕНИЯ -> { values: {col: val}, red: [col...] }
// Колонку 0 (дата) добавляет python-скрипт.
// ============================================================
const buildDataRow = (dept, note, colMap) => {
    const values = {};
    const red = [];

    values[1] = dept.federal_district;
    values[2] = dept.mchs_org;
    values[3] = dept.garrison_name;
    values[4] = dept.department_type_name;
    values[5] = dept.short_name;

    const data = note?.data || {};
    const isApproved = note?.status === 'approved';
    const technique = Array.isArray(data.technique) ? data.technique : [];

    // Все колонки техники + пожарный поезд (для строки «пустая/черновик»)
    const techCols = [];
    for (const e of colMap) techCols.push(e.col, e.col + 1, e.col + 2, e.col + 3);
    techCols.push(142, 143);

    if (isApproved) {
        for (const e of colMap) {
            const c = e.col;
            const t = findTechnique(technique, e.category, e.label);
            if (t) {
                values[c] = num(t.in_calc);
                values[c + 1] = num(t.second);
                values[c + 2] = num(t.maintenance);
                values[c + 3] = num(t.repair);
            } else {
                red.push(c, c + 1, c + 2, c + 3);
            }
        }

        const ft = technique.find((t) => {
            const isCat = String(t.category || '') === 'Пожарный поезд';
            const isName =
                /пожарный\s*поезд/i.test(String(t.short_name || '')) ||
                /пожарный\s*поезд/i.test(String(t.name || ''));
            return isCat && isName;
        });
        if (ft) {
            values[142] = num(ft.in_calc);
            values[143] = num(ft.second);
        } else {
            red.push(142, 143);
        }
    } else {
        // Пустая строевая (нет записи или черновик) — вся техника красная
        red.push(...techCols);
    }

    if (isApproved) {
        // Огнетушащие вещества
        const ex = data.extinguishing || {};
        values[144] = num(ex.on_vehicle?.foam);
        values[145] = num(ex.on_vehicle?.powder);
        values[146] = num(ex.reserve?.foam);
        values[147] = num(ex.reserve?.powder);

        // СИЗОД
        const s = data.personnel?.sizod || {};
        values[148] = num(s.dasv?.calc);
        values[149] = num(s.dasv?.reserve);
        values[150] = num(s.dask?.calc);
        values[151] = num(s.dask?.reserve);
        values[152] = num(s.suits?.l1);
        values[153] = num(s.suits?.tok);
        values[154] = num(s.suits?.other);
        values[155] = num(s.gasi?.calc);
        values[156] = num(s.gasi?.reserve);

        // Дежурный караул
        const g = data.personnel?.guard || {};
        values[157] = num(g.chief);
        values[158] = num(g.assistant);
        values[159] = num(g.commander);
        values[160] = num(g.driver);
        values[161] = num(g.fireman);
        values[162] = num(g.gas_protection);
        values[163] = num(g.rescuer);
        values[164] = num(g.cynologist);
        values[165] = num(g.diver);
        values[166] = num(g.medical);
        values[167] = num(g.dispatcher);

        // Отсутствует
        const a = data.personnel?.absent || {};
        values[168] = num(a.vacation);
        values[169] = num(a.sick);
        values[170] = num(a.trip);
        values[171] = num(a.other);

        // СПТ/01
        const cgps = (data.personnel?.cgps || []).reduce((m, c) => {
            m[String(c.name || '').trim().toLowerCase()] = c;
            return m;
        }, {});
        const terr = cgps['территориальная спт'];
        const mest = cgps['местные спт'];
        const cppc = cgps['цппс'];
        values[172] = num(terr?.created);
        values[173] = num(mest?.created);
        values[174] = num(cppc?.created);
        values[175] = num(terr?.list);
        values[176] = num(terr?.present);
        values[177] = num(mest?.list);
        values[178] = num(mest?.present);
        values[179] = num(cppc?.list);
        values[180] = num(cppc?.present);
    } else {
        // Личный состав / средства защиты — красные (строевая пустая/черновик)
        for (let c = 144; c <= 180; c++) red.push(c);
    }

    return { values, red };
};

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ ЭКСПОРТА (python-скрипт сохраняет стили шаблона)
// ============================================================
const exportLineNotes = async ({ date, federalDistrict, mchsOrg }) => {
    const { rows: departments, ignored } = await loadDepartments();
    const notes = await loadNotes(date, departments.map((d) => d.id));
    const colMap = readColumnMap();

    const rows = departments.map((dept) =>
        buildDataRow(
            {
                federal_district: federalDistrict,
                mchs_org: mchsOrg,
                garrison_name: dept.garrison_name,
                department_type_name: dept.department_type_name,
                short_name: dept.short_name,
            },
            notes[dept.id],
            colMap
        )
    );

    const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dataPath = path.join(os.tmpdir(), `ln_export_${stamp}.json`);
    const outPath = path.join(os.tmpdir(), `ln_export_${stamp}.xls`);

    fs.writeFileSync(dataPath, JSON.stringify({ start_row: 6, rows }));
    try {
        execFileSync('python', [SCRIPT_PATH, TEMPLATE_PATH, dataPath, outPath], {
            stdio: 'ignore',
        });
        const buffer = fs.readFileSync(outPath);
        return { buffer, filename: `Строевая_${date}.xls`, ignored };
    } finally {
        if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }
};

module.exports = { exportLineNotes };