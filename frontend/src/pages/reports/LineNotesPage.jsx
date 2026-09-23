import { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ru } from 'react-day-picker/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs';
import { useAuth } from '../../context/AuthContext';
import { useDepartments } from '../../hooks/useDepartments';
import { useUnitTypes } from '../../hooks/useUnits';
import {
    useLineNotesByDepartment,
    useLineNote,
    useLineNotesStatus,
    useCreateLineNote,
    useUpdateLineNote,
    useCopyLineNote,
    useExportLineNotes,
} from '../../hooks/useLineNotes';
import { usePermissions } from '../../hooks/usePermissions';
import { Loader2, Save, FileText, Truck, CheckCircle2, RotateCcw, Search, Building2, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

// ------------------------------------------------------------
// Константы
// ------------------------------------------------------------
const CATEGORY_ORDER = [
    'Основная техника',
    'Специальная техника',
    'Вспомогательная техника',
    'Пожарный поезд',
    'Приспособленная и другая',
];

const COLUMNS_BY_CATEGORY = {
    'Основная техника': [
        { key: 'in_calc', label: 'В расчете' },
        { key: 'second', label: 'В резерве' },
        { key: 'maintenance', label: 'ТО' },
        { key: 'repair', label: 'Ремонт' },
    ],
    'Специальная техника': [
        { key: 'in_calc', label: 'В расчете' },
        { key: 'second', label: 'В резерве' },
        { key: 'maintenance', label: 'ТО' },
        { key: 'repair', label: 'Ремонт' },
    ],
    'Вспомогательная техника': [
        { key: 'in_calc', label: 'В расчете' },
        { key: 'second', label: 'Исправна' },
        { key: 'maintenance', label: 'ТО' },
        { key: 'repair', label: 'Ремонт' },
    ],
    'Приспособленная и другая': [
        { key: 'in_calc', label: 'В расчете' },
        { key: 'second', label: 'Исправна' },
        { key: 'maintenance', label: 'ТО' },
        { key: 'repair', label: 'Ремонт' },
    ],
    'Пожарный поезд': [
        { key: 'in_calc', label: 'В расчете' },
        { key: 'second', label: 'Не в расчете' },
    ],
};

const GUARD_FIELDS = [
    ['chief', 'Начальник караула'],
    ['assistant', 'Помощник нач.караула'],
    ['commander', 'Командир отделения'],
    ['rescuer', 'Спасатель'],
    ['diver', 'Водолаз'],
    ['dispatcher', 'Диспетчер (Радиотелефонист)'],
    ['driver', 'Водитель'],
    ['fireman', 'Пожарный'],
    ['gas_protection', 'Газодымозащитник'],
    ['cynologist', 'Кинолог'],
    ['medical', 'Мед. работник'],
];

const ABSENT_FIELDS = [
    ['vacation', 'Отпуск'],
    ['sick', 'Болезнь'],
    ['trip', 'Командировка'],
    ['other', 'Прочие'],
];

const CGPS_NAMES = ['Территориальная СПТ', 'Местные СПТ', 'ЦППС'];

const SUITS_FIELDS = [
    ['l1', 'Л-1'],
    ['tok', 'ТОК'],
    ['other', 'Другие'],
];

// ------------------------------------------------------------
// Хелперы
// ------------------------------------------------------------
const toDateStr = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

// 'YYYY-MM-DD' -> 'DD.MM.YYYY'
const toDotDate = (iso) => {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

const fromIso = (v) => {
    if (!v) return null;
    // Если пришёл объект Date (так pg отдаёт колонку DATE) — берём локальную дату
    if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) return null;
        return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }
    // Иначе ожидаем строку 'YYYY-MM-DD' (или ISO-дату с временем)
    const s = String(v);
    const parts = s.slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v) || 0) : 0);

const blankPersonnel = () => ({
    list: 0,
    present: 0,
    guard: Object.fromEntries(GUARD_FIELDS.map(([k]) => [k, 0])),
    absent: Object.fromEntries(ABSENT_FIELDS.map(([k]) => [k, 0])),
    cgps: CGPS_NAMES.map((name) => ({ name, created: 0, list: 0, present: 0 })),
    sizod: {
        dasv: { calc: 0, reserve: 0 },
        dask: { calc: 0, reserve: 0 },
        gasi: { calc: 0, reserve: 0 },
        suits: Object.fromEntries(SUITS_FIELDS.map(([k]) => [k, 0])),
    },
});

// Соединяет данные записи с текущим списком типов техники
const composePersonnel = (saved) => {
    const src = saved?.data?.personnel || {};
    const out = blankPersonnel();
    out.list = num(src.list);
    out.present = num(src.present);
    if (src.guard) {
        for (const [k] of GUARD_FIELDS) out.guard[k] = num(src.guard[k]);
    }
    if (src.absent) {
        for (const [k] of ABSENT_FIELDS) out.absent[k] = num(src.absent[k]);
    }
    if (Array.isArray(src.cgps)) {
        out.cgps = CGPS_NAMES.map((name, i) => ({
            name,
            created: num(src.cgps[i]?.created),
            list: num(src.cgps[i]?.list),
            present: num(src.cgps[i]?.present),
        }));
    }
    if (src.sizod) {
        for (const key of ['dasv', 'dask', 'gasi']) {
            out.sizod[key].calc = num(src.sizod[key]?.calc);
            out.sizod[key].reserve = num(src.sizod[key]?.reserve);
        }
        if (src.sizod.suits) {
            for (const [k] of SUITS_FIELDS) out.sizod.suits[k] = num(src.sizod.suits[k]);
        }
    }
    return out;
};

const blankExtinguishing = () => ({
    on_vehicle: { foam: 0, powder: 0 },
    reserve: { foam: 0, powder: 0 },
});

const composeExtinguishing = (saved) => {
    const src = saved?.data?.extinguishing || {};
    return {
        on_vehicle: {
            foam: num(src.on_vehicle?.foam),
            powder: num(src.on_vehicle?.powder),
        },
        reserve: {
            foam: num(src.reserve?.foam),
            powder: num(src.reserve?.powder),
        },
    };
};

// ------------------------------------------------------------
// Поле ввода числа
// ------------------------------------------------------------
const NumberInput = ({ value, onChange, disabled = false }) => (
    <input
        type="number"
        min={0}
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
    />
);

const NumCell = ({ value }) => (
    <span className="font-medium text-slate-800 tabular-nums">{value ?? 0}</span>
);

// ------------------------------------------------------------
// Вкладка «Техника» — блоки по категориям
// ------------------------------------------------------------
const TechniqueTab = ({ note, onChangeRow, onChangeExtinguishing, disabled }) => {
    const rows = note?.technique || [];
    const ext = note?.extinguishing || blankExtinguishing();
    const setCell = (unitTypeId, key, value) => onChangeRow(unitTypeId, key, num(value));
    const setExt = (category, key, value) => onChangeExtinguishing?.(category, key, num(value));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {CATEGORY_ORDER.map((category) => {
                const columns = COLUMNS_BY_CATEGORY[category] || [];
                const categoryRows = rows.filter((r) => r.category === category);
                const hasCatCols = columns.some(
                    (c) => c.key === 'maintenance' || c.key === 'repair'
                );
                const catCols = columns.filter(
                    (c) => c.key === 'maintenance' || c.key === 'repair'
                );
                const singleCols = columns.filter(
                    (c) => c.key !== 'maintenance' && c.key !== 'repair'
                );

                return (
                    <section
                        key={category}
                        className="rounded-lg border border-slate-200 bg-white overflow-x-auto"
                    >
                        <h4 className="px-2.5 py-1.5 bg-slate-100 text-sm font-semibold text-slate-700">
                            {category}
                        </h4>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600">
                                    <th
                                        className="px-2 py-1.5 text-left text-xs"
                                        rowSpan={hasCatCols ? 2 : 1}
                                    >
                                        Тип
                                    </th>
                                    {singleCols.map((c) => (
                                        <th
                                            key={c.key}
                                            className="px-1.5 py-1.5 text-center text-xs"
                                            rowSpan={hasCatCols ? 2 : 1}
                                        >
                                            {c.label}
                                        </th>
                                    ))}
                                    {hasCatCols && (
                                        <th
                                            colSpan={catCols.length}
                                            className="px-1.5 py-1 text-center text-xs"
                                        >
                                            Не в расчете
                                        </th>
                                    )}
                                </tr>
                                {hasCatCols && (
                                    <tr className="bg-slate-50 text-slate-600">
                                        {catCols.map((c) => (
                                            <th key={c.key} className="px-1.5 py-1 text-center text-xs">
                                                {c.label}
                                            </th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {categoryRows.length === 0 ? (
                                    <tr className="bg-white">
                                        <td colSpan={columns.length + 1} className="px-2 py-2 text-xs text-slate-400">
                                            Нет типов техники
                                        </td>
                                    </tr>
                                ) : categoryRows.map((row) => (
                                    <tr key={row.unit_type_id} className="hover:bg-slate-50">
                                        <td className="px-2 py-1 font-medium text-slate-800 text-xs">
                                            {row.short_name || row.name}
                                        </td>
                                        {columns.map((c) => (
                                            <td key={c.key} className="px-1.5 py-1 text-center">
                                                <NumberInput
                                                    value={row[c.key]}
                                                    disabled={disabled}
                                                    onChange={(v) => setCell(row.unit_type_id, c.key, v)}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                <tr className="bg-slate-100 font-medium">
                                    <td className="px-2 py-1 text-slate-700 text-xs">Всего</td>
                                    {columns.map((c) => (
                                        <td key={c.key} className="px-1.5 py-1 text-center">
                                            <NumCell
                                                value={categoryRows.reduce(
                                                    (acc, r) => acc + num(r[c.key]),
                                                    0
                                                )}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </section>
                );
            })}



                {/* Огнетушащие */}
                <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                    <h4 className="px-2.5 py-1.5 bg-slate-100 text-sm font-semibold text-slate-700">
                        Огнетушащие
                    </h4>
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-slate-50 text-slate-600">
                            <th className="px-2 py-1.5 text-left text-xs">Средство</th>
                            <th className="px-1.5 py-1.5 text-center text-xs">Возимые на ПА</th>
                            <th className="px-1.5 py-1.5 text-center text-xs">В резерве</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1 font-medium text-slate-800 text-xs">
                                Пенообразователь (л.)
                            </td>
                            <td className="px-1.5 py-1 text-center">
                                <NumberInput
                                    value={ext.on_vehicle.foam}
                                    disabled={disabled}
                                    onChange={(v) => setExt('on_vehicle', 'foam', v)}
                                />
                            </td>
                            <td className="px-1.5 py-1 text-center">
                                <NumberInput
                                    value={ext.reserve.foam}
                                    disabled={disabled}
                                    onChange={(v) => setExt('reserve', 'foam', v)}
                                />
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1 font-medium text-slate-800 text-xs">
                                Порошок (кг.)
                            </td>
                            <td className="px-1.5 py-1 text-center">
                                <NumberInput
                                    value={ext.on_vehicle.powder}
                                    disabled={disabled}
                                    onChange={(v) => setExt('on_vehicle', 'powder', v)}
                                />
                            </td>
                            <td className="px-1.5 py-1 text-center">
                                <NumberInput
                                    value={ext.reserve.powder}
                                    disabled={disabled}
                                    onChange={(v) => setExt('reserve', 'powder', v)}
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </section>
            </div>

        </div>
    );
};

// ------------------------------------------------------------
// Вкладка «Личный состав / Средства защиты»
// ------------------------------------------------------------
const PersonnelTab = ({ note, onChange, disabled }) => {
    const p = note?.personnel || blankPersonnel();
    const setField = (section, key, value) => onChange({
        ...p,
        [section]: { ...p[section], [key]: num(value) },
    });
    const setTop = (key, value) => onChange({ ...p, [key]: num(value) });
    const setCgps = (index, key, value) => onChange({
        ...p,
        cgps: p.cgps.map((c, i) => (i === index ? { ...c, [key]: num(value) } : c)),
    });
    const setSizod = (base, key, value) => onChange({
        ...p,
        sizod: { ...p.sizod, [base]: { ...p.sizod[base], [key]: num(value) } },
    });
    const setSuits = (key, value) => onChange({
        ...p,
        sizod: { ...p.sizod, suits: { ...p.sizod.suits, [key]: num(value) } },
    });

    const guardTotal = GUARD_FIELDS.reduce((a, [k]) => a + num(p.guard[k]), 0);
    const absentTotal = ABSENT_FIELDS.reduce((a, [k]) => a + num(p.absent[k]), 0);
    const sizodTotalCalc = num(p.sizod.dasv.calc) + num(p.sizod.dask.calc);
    const sizodTotalReserve = num(p.sizod.dasv.reserve) + num(p.sizod.dask.reserve);

    const labelRow = (labelText, current, setValue) => (
        <div className="flex items-center justify-between py-1">
            <span className="text-sm text-slate-700 truncate pr-2">{labelText}</span>
            <NumberInput value={current} disabled={disabled} onChange={setValue} />
        </div>
    );

    // Двухколоночный ряд СИЗОД, выровненный по единой сетке
    const sizodRow = (labelText, obj, base) => (
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-1.5 py-1">
            <span className="text-sm text-slate-700 truncate">{labelText}</span>
            <div className="flex justify-center">
                <NumberInput value={obj.calc} disabled={disabled} onChange={(v) => setSizod(base, 'calc', v)} />
            </div>
            <div className="flex justify-center">
                <NumberInput value={obj.reserve} disabled={disabled} onChange={(v) => setSizod(base, 'reserve', v)} />
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            {/* Колонка 1: Личный состав + Отсутствует */}
            <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Личный состав</h4>
                    {labelRow('По списку', p.list, (v) => setTop('list', v))}
                    {labelRow('Налицо', p.present, (v) => setTop('present', v))}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Отсутствует</h4>
                    {ABSENT_FIELDS.map(([k, text]) => labelRow(text, p.absent[k], (v) => setField('absent', k, v)))}
                    <div className="flex items-center justify-between py-1 bg-slate-100 rounded-md px-2 mt-1">
                        <span className="text-sm font-medium text-slate-700 flex-1">Всего</span>
                        <NumCell value={absentTotal} />
                    </div>
                </div>
            </div>

            {/* Колонка 2: Дежурный караул */}
            <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Дежурный караул</h4>
                    {GUARD_FIELDS.map(([k, text]) => labelRow(text, p.guard[k], (v) => setField('guard', k, v)))}
                    <div className="flex items-center justify-between py-1 bg-slate-100 rounded-md px-2 mt-1">
                        <span className="text-sm font-medium text-slate-700 flex-1">Всего</span>
                        <NumCell value={guardTotal} />
                    </div>
                </div>
            </div>


            {/* Колонка 3: СПТ/01 + СИЗОД */}
            <div className="space-y-4">
                {/* СПТ/01 */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 overflow-x-auto">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">СПТ/01</h4>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-600">
                            <th className="px-3 py-2 text-left" rowSpan={2}>Наименование</th>
                            <th className="px-2 py-2 text-center" rowSpan={2}>Создано</th>
                            <th className="px-2 py-1.5 text-center" colSpan={2}>Личный состав</th>
                        </tr>
                        <tr className="bg-slate-50 text-slate-600">
                            <th className="px-2 py-1.5 text-center text-xs">По списку</th>
                            <th className="px-2 py-1.5 text-center text-xs">Налицо</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {p.cgps.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                                <td className="px-2 py-1.5 text-center">
                                    <NumberInput value={row.created} disabled={disabled}
                                        onChange={(v) => setCgps(i, 'created', v)} />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <NumberInput value={row.list} disabled={disabled}
                                        onChange={(v) => setCgps(i, 'list', v)} />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <NumberInput value={row.present} disabled={disabled}
                                        onChange={(v) => setCgps(i, 'present', v)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* СИЗОД */}
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">СИЗОД</h4>
                    <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-1.5 px-1 pb-1 text-xs text-slate-500">
                        <span></span>
                        <span className="text-center">В расчете</span>
                        <span className="text-center">В резерве</span>
                    </div>
                    {sizodRow('ДАСВ', p.sizod.dasv, 'dasv')}
                    {sizodRow('ДАСК', p.sizod.dask, 'dask')}
                    <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-1.5 py-1 bg-slate-100 rounded-md px-1">
                        <span className="text-sm font-medium text-slate-700">Всего</span>
                        <span className="text-center font-semibold text-slate-800 tabular-nums">{sizodTotalCalc}</span>
                        <span className="text-center font-semibold text-slate-800 tabular-nums">{sizodTotalReserve}</span>
                    </div>
                    {sizodRow('ГАСИ', p.sizod.gasi, 'gasi')}

                    <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                            Защитные костюмы
                        </p>
                        {SUITS_FIELDS.map(([k, text]) => labelRow(text, p.sizod.suits[k], (v) => setSuits(k, v)))}
                    </div>
                </div>
            </div>

        </div>
    );
};

// Собирает состояние записки из данных БД + актуального списка типов
const composeNote = (saved, types) => {
    const savedTech = (saved?.data?.technique || []).reduce((m, r) => {
        m[r.unit_type_id] = r;
        return m;
    }, {});
    const technique = types
        .filter((t) => t.show_in_line_note)
        .sort(
            (a, b) =>
                (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                String(a.name).localeCompare(String(b.name))
        )
        .map((t) => ({
            unit_type_id: t.id,
            short_name: t.short_name,
            name: t.name,
            category: t.category,
            in_calc: num(savedTech[t.id]?.in_calc),
            second: num(savedTech[t.id]?.second),
            maintenance: num(savedTech[t.id]?.maintenance),
            repair: num(savedTech[t.id]?.repair),
        }));

    return {
        id: saved?.id || null,
        status: saved?.status || 'draft',
        technique,
        personnel: composePersonnel(saved),
        extinguishing: composeExtinguishing(saved),
    };
};

// Кастомная ячейка календаря: одинаковый цветовой фон и точка-маркер для записей
const NoteDayCell = ({ className, children, modifiers = {}, ...props }) => {
    const draft = !!modifiers['note-draft'];
    const approved = !!modifiers['note-approved'];
    const markerColor = approved ? 'bg-emerald-600' : 'bg-amber-500';
    return (
        <div className={cn('relative', className)} {...props}>
            {children}
            {(draft || approved) && (
                <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0.5 mx-auto h-1.5 w-1.5 rounded-full ${markerColor}`}
                />
            )}
        </div>
    );
};

// ------------------------------------------------------------
// Страница «Строевая записка»
// ------------------------------------------------------------
const LineNotesPage = () => {
    const { has } = usePermissions();
    const { user } = useAuth();
    const { data: departmentsData } = useDepartments();
    const { data: typesData, isLoading: typesLoading } = useUnitTypes();

    const departments = useMemo(() => {
        const arr = Array.isArray(departmentsData) ? departmentsData : departmentsData?.data;
        return Array.isArray(arr) ? arr : [];
    }, [departmentsData]);

    const types = useMemo(() => {
        const arr = Array.isArray(typesData) ? typesData : typesData?.data;
        return Array.isArray(arr) ? arr : [];
    }, [typesData]);

    const [departmentId, setDepartmentId] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [deptQuery, setDeptQuery] = useState('');
    const dateStr = toDateStr(selectedDate);

    // Полный плоский список в иерархическом порядке: корневое → его дети →
    // внуки, в любую глубину. Строим дерево ПЕРВЫМ из всех подразделений,
    // затем просто отфильтровываем (порядок сохраняется) — скрытые просто
    // «пропускаются», их подчинённые не теряются и не переезжают в конец.
    const allFlatDepts = useMemo(() => {
        if (!departments.length) return [];
        const deptSet = new Set(departments.map((d) => d.id));
        const byParent = new Map();
        const roots = [];
        for (const d of departments) {
            if (d.parent_id && deptSet.has(d.parent_id)) {
                if (!byParent.has(d.parent_id)) byParent.set(d.parent_id, []);
                byParent.get(d.parent_id).push(d);
            } else {
                roots.push(d);
            }
        }
        const sortNodes = (list) =>
            [...list].sort(
                (a, b) =>
                    (a.sort_order || 0) - (b.sort_order || 0) ||
                    String(a.name || '').localeCompare(String(b.name || ''), 'ru')
            );
        const flat = [];
        const walk = (list) => {
            for (const n of sortNodes(list)) {
                flat.push(n);
                walk(byParent.get(n.id) || []);
            }
        };
        walk(roots);
        return flat;
    }, [departments]);

    // Только подразделения, доступные пользователю и отображаемые в строевой записке.
    // Порядок сохраняется: скрытые (show_in_line_note=false) просто «пропускаются»,
    // их дети не переезжают в конец списка.
    const accessibleDepts = useMemo(() => {
        const ids = user?.department_ids || [];
        const visible = allFlatDepts.filter((d) => d.show_in_line_note !== false);
        if (user?.can_view_all) return visible;
        return visible.filter((d) => ids.includes(d.id));
    }, [allFlatDepts, user]);

    // Автовыбор, если доступно ровно одно подразделение
    const activeDeptId =
        departmentId || (accessibleDepts.length === 1 ? accessibleDepts[0].id : '');

    const filteredDepts = useMemo(() => {
        if (!deptQuery.trim()) return accessibleDepts;
        const q = deptQuery.toLowerCase();
        return accessibleDepts.filter((d) => (d.name || '').toLowerCase().includes(q));
    }, [accessibleDepts, deptQuery]);

    const { data: notes = [] } = useLineNotesByDepartment(activeDeptId);
    const noteQuery = useLineNote(activeDeptId, dateStr);
    const createMut = useCreateLineNote();
    const updateMut = useUpdateLineNote();

    // Статусы записей всех доступных подразделений на выбранную дату (для бейджей в списке)
    const { data: statuses = [] } = useLineNotesStatus(dateStr);
    const statusByDept = useMemo(
        () => new Map(statuses.map((s) => [s.department_id, s.status])),
        [statuses]
    );

    const noteKey = activeDeptId ? `${activeDeptId}|${dateStr}` : '';

    // Базовая записка — чистое производное от данных запроса (пересобирается при смене даты)
    const baseNote = useMemo(() => {
        if (!activeDeptId || !dateStr || typesLoading) return null;
        if (noteQuery.status !== 'success' && noteQuery.status !== 'error') return null;
        return noteQuery.status === 'success' && noteQuery.data
            ? composeNote(noteQuery.data, types)
            : composeNote(null, types);
    }, [activeDeptId, dateStr, noteQuery.status, typesLoading, types, noteQuery.data]);

    // Правки пользователя по каждой записи (до сохранения), поверх базовой
    const [snapshots, setSnapshots] = useState({});

    const mergeSnap = useCallback((base, snap) => {
        if (!snap) return base;
        const techniqueById = Object.fromEntries(
            snap.technique.map((r) => [r.unit_type_id, r])
        );
        const technique = base.technique.map((t) =>
            techniqueById[t.unit_type_id] ? { ...t, ...techniqueById[t.unit_type_id] } : t
        );
        return {
            ...base,
            id: snap.id ?? base.id,
            status: snap.status ?? base.status,
            technique,
            personnel: { ...base.personnel, ...snap.personnel },
            extinguishing: { ...base.extinguishing, ...snap.extinguishing },
        };
    }, []);

    const note = useMemo(
        () => (baseNote ? mergeSnap(baseNote, snapshots[noteKey]) : null),
        [baseNote, snapshots, noteKey, mergeSnap]
    );

    const setNote = (updater) => {
        if (!baseNote) return;
        setSnapshots((prev) => {
            const current = mergeSnap(baseNote, prev[noteKey]);
            const next = typeof updater === 'function' ? updater(current) : updater;
            return next ? { ...prev, [noteKey]: next } : prev;
        });
    };

    const canManage = has('line_notes.manage');
    const canApprove = has('line_notes.approve');
    const canEditApproved = has('line_notes.edit_approved');
    const isLoadingNote = noteQuery.isLoading || typesLoading;

    const canEdit = note ? (note.status === 'approved' ? canEditApproved : canManage) : false;

    const [approveOpen, setApproveOpen] = useState(false);
    const [unapproveOpen, setUnapproveOpen] = useState(false);

    // —— Копирование записки на другую дату ——
    const copyMut = useCopyLineNote();
    const [copyFrom, setCopyFrom] = useState(() => toDateStr(new Date()));
    const [copyTo, setCopyTo] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);

    const targetNote = (notes || []).find((n) => {
        const d = fromIso(n.note_date);
        return d && toDateStr(d) === copyTo;
    });
    const targetApproved = !!targetNote && targetNote.status === 'approved';
    const targetExistingDraft = !!targetNote && targetNote.status === 'draft';
    const copyDatesValid =
        /^\d{4}-\d{2}-\d{2}$/.test(copyFrom) && /^\d{4}-\d{2}-\d{2}$/.test(copyTo);
    const canCopy =
        !!activeDeptId && canManage && copyDatesValid && copyFrom !== copyTo && !targetApproved;

    const handleCopy = async () => {
        setCopyOpen(false);
        try {
            await copyMut.mutateAsync({
                department_id: activeDeptId,
                from_date: copyFrom,
                to_date: copyTo,
            });
            toast.success('Строевая записка скопирована');
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Не удалось скопировать записку');
        }
    };

    // —— Выгрузка в Excel по шаблону (для всех подразделений) ——
    const canViewAll = !!user?.can_view_all || user?.role === 'developer';
    const exportMut = useExportLineNotes();
    const [exportOpen, setExportOpen] = useState(false);
    const [exportDistrict, setExportDistrict] = useState('Южный ФО');
    const [exportOrg, setExportOrg] = useState(
        'ГУ МЧС России по Луганской Народной Республике'
    );
    const [exportWarning, setExportWarning] = useState('');

    const handleExportSave = async () => {
        try {
            const res = await exportMut.mutateAsync({
                date: dateStr,
                federal_district: exportDistrict.trim(),
                mchs_org_name: exportOrg.trim(),
            });
            const { base64, ignored } = res.data;

            // Декодируем base64 и скачиваем файл
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            a.download = `Строевая ${toDotDate(dateStr)}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (ignored && ignored.length) {
                setExportWarning(
                    `Без гарнизона или вида игнорируются подразделения: ${ignored.join(', ')}`
                );
            } else {
                setExportWarning('');
                setExportOpen(false);
                toast.success('Файл сформирован');
            }
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Не удалось сформировать выгрузку');
        }
    };

    const modifiers = useMemo(() => {
        const draft = [];
        const approved = [];
        (notes || []).forEach((n) => {
            const d = fromIso(n.note_date);
            if (!d) return;
            (n.status === 'draft' ? draft : approved).push(d);
        });
        return { 'note-draft': draft, 'note-approved': approved };
    }, [notes]);

    const modifiersClassNames = {
        'note-draft': 'bg-amber-200 text-amber-900',
        'note-approved': 'bg-emerald-200 text-emerald-900',
    };

    const setTechniqueCell = (unitTypeId, key, value) =>
        setNote((n) =>
            n
                ? {
                      ...n,
                      technique: n.technique.map((r) =>
                          r.unit_type_id === unitTypeId ? { ...r, [key]: value } : r
                      ),
                  }
                : n
        );

    const setPersonnel = (personnel) => setNote((n) => (n ? { ...n, personnel } : n));

    const setExtinguishing = (category, key, value) =>
        setNote((n) =>
            n
                ? {
                      ...n,
                      extinguishing: {
                          ...n.extinguishing,
                          [category]: { ...n.extinguishing[category], [key]: num(value) },
                      },
                  }
                : n
        );

    // Сохранение (создание или обновление) записки. statusOverride позволяет
    // сразу перевести в другой статус (утверждение/возврат в черновик).
    const persist = async (statusOverride) => {
        if (!activeDeptId) {
            toast.error('Выберите подразделение');
            return;
        }
        if (!note) return;
        const status = statusOverride ?? note.status;
        const payload = {
            technique: note.technique,
            personnel: note.personnel,
            extinguishing: note.extinguishing,
        };
        try {
            if (note.id) {
                await updateMut.mutateAsync({
                    id: note.id,
                    data: { status, data: payload },
                });
            } else {
                const res = await createMut.mutateAsync({
                    department_id: activeDeptId,
                    note_date: dateStr,
                    status,
                    data: payload,
                });
                setSnapshots((prev) => {
                    const snap = mergeSnap(baseNote, prev[noteKey]);
                    return snap ? { ...prev, [noteKey]: { ...snap, id: res.data.id, status } } : prev;
                });
            }
            setNote((n) => (n ? { ...n, status } : n));
            toast.success('Строевая записка сохранена');
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Не удалось сохранить записку');
        }
    };

    const saving = createMut.isPending || updateMut.isPending;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-orange-500" />
                    Строевая записка
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Выберите подразделение и дату. Дни с запиской выделяются цветом по статусу.
                </p>
            </div>

            <Card>
                <CardContent className="flex flex-col lg:flex-row gap-6 items-stretch">
                    {/* Список подразделений */}
                    <div className="w-full lg:w-64 shrink-0 flex flex-col">
                        <Label className="mb-2">Подразделения</Label>
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={deptQuery}
                                onChange={(e) => setDeptQuery(e.target.value)}
                                placeholder="Поиск..."
                                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>
                        <div className="flex-1 border border-slate-200 rounded-lg overflow-y-auto max-h-[320px]">
                            {filteredDepts.length === 0 ? (
                                <p className="p-3 text-sm text-slate-400">
                                    Нет доступных подразделений
                                </p>
                            ) : (
                                filteredDepts.map((d) => {
                                    const selected = d.id === activeDeptId;
                                    const st = statusByDept.get(d.id);
                                    let badge;
                                    if (st === 'approved') {
                                        badge = (
                                            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', selected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')}>
                                                Утверждённая
                                            </span>
                                        );
                                    } else if (st === 'draft') {
                                        badge = (
                                            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', selected ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 border border-amber-200')}>
                                                Черновик
                                            </span>
                                        );
                                    } else {
                                        badge = (
                                            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', selected ? 'bg-white/20 text-white' : 'bg-white text-slate-400 border border-slate-200')}>
                                                Пустая
                                            </span>
                                        );
                                    }
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => {
                                                setDepartmentId(d.id);
                                                setDeptQuery('');
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                                selected
                                                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                                                    : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Building2 className="h-4 w-4 shrink-0" />
                                            <span className="flex-1 truncate">{d.name}</span>
                                            {badge}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Календарь */}
                    <div className="flex-1 flex flex-wrap items-start gap-6">
                        <Calendar
                            mode="single"
                            numberOfMonths={1}
                            locale={ru}
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            modifiers={modifiers}
                            modifiersClassNames={modifiersClassNames}
                            components={{ Day: NoteDayCell }}
                            className="rounded-xl border border-slate-200"
                        />

                        <div className="flex flex-col gap-2 text-xs text-slate-600 pt-1">
                            <span className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded bg-amber-300 border border-amber-400 inline-block" />
                                Черновик
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded bg-emerald-300 border border-emerald-400 inline-block" />
                                Утверждённая
                            </span>
                        </div>

                        {/* Копирование записки */}
                        <div className="w-64 shrink-0 space-y-3 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Copy className="h-4 w-4 text-slate-500" />
                                Копирование записки
                            </p>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">С какой даты</Label>
                                <input
                                    type="date"
                                    value={copyFrom}
                                    onChange={(e) => setCopyFrom(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">На какую дату</Label>
                                <input
                                    type="date"
                                    value={copyTo}
                                    onChange={(e) => setCopyTo(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            {copyTo && (
                                <p className={`text-xs ${targetApproved ? 'text-red-600' : 'text-slate-500'}`}>
                                    {targetApproved
                                        ? 'Нельзя копировать: записка за эту дату уже утверждена.'
                                        : targetExistingDraft
                                            ? 'Будет заменён черновик за эту дату.'
                                            : 'Будет создан новый черновик за эту дату.'}
                                </p>
                            )}
                            <Button
                                onClick={() => setCopyOpen(true)}
                                disabled={!canCopy || copyMut.isPending}
                                className="w-full rounded-lg"
                            >
                                {copyMut.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Copy className="h-4 w-4 mr-2" />
                                )}
                                Копировать
                            </Button>
                        </div>
                        {canViewAll && (
                            <div className="w-72 shrink-0 space-y-3 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setExportWarning('');
                                    setExportOpen(true);
                                }}
                                disabled={exportMut.isPending}
                                className="w-full h-auto whitespace-normal text-left leading-tight rounded-lg"
                            >
                                {exportMut.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4 mr-2 shrink-0" />
                                )}
                                <span>
                                    Выгрузить строевые подразделений на {toDotDate(dateStr)}
                                </span>
                            </Button>
                            </div>
                        )}
                    </div>

                </CardContent>
            </Card>

            {/* Редактор записки */}
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="h-5 w-5 text-orange-500" />
                            {activeDeptId
                                ? format(selectedDate, 'd MMMM yyyy', { locale: ru })
                                : 'Выберите подразделение'}
                        </CardTitle>
                        {note &&
                            (note.status === 'approved' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                    Утверждённая
                                </Badge>
                            ) : (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                    Черновик
                                </Badge>
                            ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {activeDeptId && note && canEdit && (
                            <Button
                                onClick={() => persist()}
                                disabled={saving}
                                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Сохранить
                            </Button>
                        )}
                        {activeDeptId && note && note.status === 'draft' && canApprove && (
                            <Button
                                variant="outline"
                                onClick={() => setApproveOpen(true)}
                                disabled={saving}
                                className="rounded-lg border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                                Утвердить
                            </Button>
                        )}
                        {activeDeptId && note && note.status === 'approved' && canEditApproved && (
                            <Button
                                variant="outline"
                                onClick={() => setUnapproveOpen(true)}
                                disabled={saving}
                                className="rounded-lg border-slate-300 hover:bg-slate-100"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                В черновик
                            </Button>
                        )}
                    </div>
                </CardHeader>

                    <CardContent>
                        {!activeDeptId ? (
                            <div className="py-16 text-center text-slate-400">
                                Выберите подразделение, чтобы начать работу с записью.
                            </div>
                        ) : isLoadingNote || !note ? (
                            <div className="py-16 flex items-center justify-center text-slate-400 gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Загрузка...
                            </div>
                        ) : (
                            <Tabs defaultValue="technique">
                                <TabsList className="gap-1 p-1 rounded-lg bg-slate-100 dark:bg-white/5 h-auto">
                                    <TabsTrigger value="technique" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white rounded-md px-4 py-1.5 font-semibold">
                                        Техника
                                    </TabsTrigger>
                                    <TabsTrigger value="personnel" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white rounded-md px-4 py-1.5 font-semibold">
                                        Личный состав/Средства защиты
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="technique">
                                    <TechniqueTab
                                        note={note}
                                        onChangeRow={setTechniqueCell}
                                        onChangeExtinguishing={setExtinguishing}
                                        disabled={!canEdit}
                                    />
                                </TabsContent>
                                <TabsContent value="personnel">
                                    <PersonnelTab
                                        note={note}
                                        onChange={setPersonnel}
                                        disabled={!canEdit}
                                    />
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>

                <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Утвердить строевую записку?</AlertDialogTitle>
                            <AlertDialogDescription>
                                После утверждения записку смогут редактировать только
                                пользователи с правом «Редактирование утверждённых строевых
                                записок». Продолжить?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => persist('approved')}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                            >
                                Утвердить
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={unapproveOpen} onOpenChange={setUnapproveOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Вернуть записку в черновик?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Записка снова станет черновиком и будет доступна для
                                редактирования с правом «Редактирование». Продолжить?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => persist('draft')}
                                disabled={saving}
                                className="bg-slate-700 hover:bg-slate-800 rounded-lg"
                            >
                                В черновик
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={copyOpen} onOpenChange={setCopyOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Скопировать строевую записку?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Данные записки будут скопированы с{' '}
                                <span className="font-semibold">{copyFrom}</span> на{' '}
                                <span className="font-semibold">{copyTo}</span>.{' '}
                                {targetExistingDraft
                                    ? 'Существующий черновик за эту дату будет заменён.'
                                    : 'Будет создан новый черновик за эту дату.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleCopy}
                                disabled={copyMut.isPending}
                                className="bg-orange-600 hover:bg-orange-700 rounded-lg"
                            >
                                {copyMut.isPending ? 'Копирование...' : 'Копировать'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
                    <AlertDialogContent className="lg:max-w-2xl rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Выгрузка строевых в Excel</AlertDialogTitle>
                            <AlertDialogDescription>
                                Формируется выгрузка за{' '}
                                <span className="font-semibold">{toDotDate(dateStr)}</span> по
                                всем подразделениям по шаблону.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-3 py-2">
                            <div className="space-y-1">
                                <Label className="text-sm text-slate-600">
                                    Наименование федерального округа
                                </Label>
                                <input
                                    type="text"
                                    value={exportDistrict}
                                    onChange={(e) => setExportDistrict(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm text-slate-600">
                                    Наименование территориального органа МЧС России
                                </Label>
                                <input
                                    type="text"
                                    value={exportOrg}
                                    onChange={(e) => setExportOrg(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleExportSave}
                                disabled={exportMut.isPending}
                                className="bg-orange-600 hover:bg-orange-700 rounded-lg"
                            >
                                {exportMut.isPending ? 'Формирование...' : 'Сохранить'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                        {exportWarning && (
                            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
                                <span className="font-medium">Внимание:</span>
                                <span>{exportWarning}</span>
                            </div>
                        )}
                        {!exportWarning && (
                            <p className="mt-3 text-xs text-slate-500">
                                Подразделения без указанного гарнизона или вида будут пропущены
                                в выгрузке.
                            </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                            Если у подразделения строевая записка в статусе «Черновик» или
                            отсутствует — её поля в выгрузке будут выделены красным.
                        </p>
                    </AlertDialogContent>
                </AlertDialog>
        </div>
    );
};

export default LineNotesPage;