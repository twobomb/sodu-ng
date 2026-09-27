import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useSampleFields,
    useCallSamples,
    useSaveCallSample,
    useDeleteCallSample,
    usePreviewCallSample,
} from '../../hooks/useCallSamples';
import { usePermissions } from '../../hooks/usePermissions';
import { useDepartments } from '../../hooks/useDepartments';
import { useUnits, useUnitTypes } from '../../hooks/useUnits';
import { useMunicipalities } from '../../hooks/useCalls';
import {
    useFireCategories,
    useFireCauses,
    useFireNonaccountReasons,
} from '../../hooks/useDictionaries';
import { encodeSampleDefinition } from '../../lib/callSampleUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
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
    Loader2,
    Plus,
    Trash2,
    FolderPlus,
    Save,
    Play,
    ListFilter,
    Search,
    X,
    Undo2,
} from 'lucide-react';

// ============================================================
// ХЕЛПЕРЫ ДЛЯ ДЕРЕВА УСЛОВИЙ
// ============================================================
const cloneItems = (items = []) =>
    items.map((it) => (it.items ? { ...it, items: cloneItems(it.items) } : { ...it }));

// Вставить узел в список items, лежащий по пути parentPath ([] — корень)
const insertNode = (root, parentPath, node) => {
    const next = { ...root, items: cloneItems(root.items || []) };
    let items = next.items;
    for (const idx of parentPath) {
        items[idx].items = items[idx].items || [];
        items = items[idx].items;
    }
    items.push(node);
    return next;
};

// Удалить узел по пути
const removeNodeAt = (root, path) => {
    const next = { ...root, items: cloneItems(root.items || []) };
    const parent = path.slice(0, -1);
    const last = path[path.length - 1];
    let items = next.items;
    for (const idx of parent) items = items[idx].items;
    items.splice(last, 1);
    return next;
};

// Обновить узел по пути (updater получает узел, возвращает новый)
const updateNodeAt = (root, path, updater) => {
    const next = { ...root, items: cloneItems(root.items || []) };
    const parent = path.slice(0, -1);
    const last = path[path.length - 1];
    let items = next.items;
    for (const idx of parent) items = items[idx].items;
    items[last] = updater(items[last]);
    return next;
};

// Есть ли хотя бы одно заполненное условие
const hasAnyCondition = (items = []) =>
    items.some((it) => {
        if (it.kind === 'group') return hasAnyCondition(it.items || []);
        if (!it.field || !it.op) return false;
        if (it.op === 'is_null' || it.op === 'is_not_null') return true;
        if (it.field === 'means_qty') return !!it.value?.name;
        if (it.op === 'in' || it.op === 'not_in') return Array.isArray(it.value) && it.value.length > 0;
        if (it.op === 'between') return !!(it.value?.from || it.value?.to);
        return it.value !== '' && it.value !== null && it.value !== undefined;
    });

const newCondition = (join = 'AND') => ({
    kind: 'cond',
    join,
    negate: false,
    field: 'type',
    op: 'eq',
    value: '',
});

const newGroup = (join = 'AND') => ({
    kind: 'group',
    join,
    negate: false,
    items: [newCondition('AND')],
});

// Список из ответа API (массив или обёртка)
const asList = (data) => {
    if (Array.isArray(data)) return data;
    return data?.items || data?.data || data?.rows || [];
};

// ============================================================
// МУЛЬТИВЫБОР (для операторов «в списке» / «не в списке»)
// ============================================================
const MultiSelect = ({ options, value = [], onChange, placeholder = 'Добавить значение...', disabled }) => {
    const arr = Array.isArray(value) ? value : [];
    const labelOf = (v) => options.find((o) => o.value === v)?.label || v;
    const available = options.filter((o) => !arr.includes(o.value));

    return (
        <div className="space-y-1.5">
            {arr.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {arr.map((v) => (
                        <span
                            key={v}
                            className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] text-orange-800"
                        >
                            {labelOf(v)}
                            {!disabled && (
                                <button type="button" onClick={() => onChange(arr.filter((x) => x !== v))}>
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}
            {!disabled && (
                <SearchableSelect
                    options={available}
                    value=""
                    onChange={(v) => v && onChange([...arr, v])}
                    placeholder={placeholder}
                    emptyText="Нет доступных значений"
                />
            )}
        </div>
    );
};

// ============================================================
// ВВОД ЗНАЧЕНИЯ (зависит от типа поля и оператора)
// ============================================================
const ValueInput = ({ def, op, value, onChange, refOptions, disabled }) => {
    if (def.type === 'means_qty') {
        const v = value && typeof value === 'object' ? value : { name: '', qty: '' };
        return (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <SearchableSelect
                    options={def.options || []}
                    value={v.name || ''}
                    onChange={(name) => onChange({ ...v, name })}
                    placeholder="Средство..."
                    disabled={disabled}
                    className="flex-1"
                />
                <Input
                    type="number"
                    value={v.qty ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...v, qty: e.target.value })}
                    placeholder="Кол-во"
                    className="w-full rounded-lg sm:w-28"
                />
            </div>
        );
    }

    const isMulti = op === 'in' || op === 'not_in';
    const options = def.type === 'enum' ? (def.options || []) : (refOptions || []);

    if (isMulti) {
        return <MultiSelect options={options} value={value} onChange={onChange} disabled={disabled} />;
    }

    if (def.type === 'boolean') {
        const current = value === true || value === 'true' ? 'true'
            : value === false || value === 'false' ? 'false' : '';
        return (
            <NativeSelect
                value={current}
                onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')}
                className="w-full rounded-lg"
                disabled={disabled}
            >
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption value="true">Да</NativeSelectOption>
                <NativeSelectOption value="false">Нет</NativeSelectOption>
            </NativeSelect>
        );
    }

    if (op === 'between') {
        const v = value && typeof value === 'object' && !Array.isArray(value) ? value : { from: '', to: '' };
        const inputType = def.type === 'date' ? 'datetime-local' : 'number';
        return (
            <div className="flex items-center gap-1.5">
                <Input
                    type={inputType}
                    value={v.from ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...v, from: e.target.value })}
                    placeholder="От"
                    className="rounded-lg"
                />
                <span className="text-xs text-slate-400 shrink-0">—</span>
                <Input
                    type={inputType}
                    value={v.to ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...v, to: e.target.value })}
                    placeholder="До"
                    className="rounded-lg"
                />
            </div>
        );
    }

    if (def.type === 'enum') {
        return (
            <NativeSelect
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg"
                disabled={disabled}
            >
                <NativeSelectOption value="">—</NativeSelectOption>
                {(def.options || []).map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
                ))}
            </NativeSelect>
        );
    }

    if (def.type === 'ref') {
        return (
            <SearchableSelect
                options={options}
                value={value ?? ''}
                onChange={(v) => onChange(v)}
                placeholder="Выберите значение..."
                emptyText="Нет доступных значений"
                disabled={disabled}
            />
        );
    }

    return (
        <Input
            type={def.type === 'number' ? 'number' : def.type === 'date' ? 'datetime-local' : 'text'}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.type === 'number' ? 'Число...' : 'Значение...'}
            className="rounded-lg"
        />
    );
};

// Значение по умолчанию для оператора
const defaultValueFor = (op) =>
    op === 'in' || op === 'not_in' ? [] : op === 'between' ? { from: '', to: '' } : '';

const opNeedsValue = (op) => op !== 'is_null' && op !== 'is_not_null';

// ============================================================
// ОДНО УСЛОВИЕ
// ============================================================
const ConditionRow = ({ node, isFirst, ctx }) => {
    const { fieldMap, fieldGroups, ops, refOptionsFor, onPatch, onRemove, disabled } = ctx;
    const def = fieldMap[node.field] || null;
    const allowedOps = def?.ops?.length ? def.ops : ['eq'];

    const changeField = (key) => {
        const next = fieldMap[key];
        const op = next?.ops?.[0] || 'eq';
        onPatch({ field: key, op, value: defaultValueFor(op) });
    };

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap items-center gap-1.5">
                {!isFirst && (
                    <NativeSelect
                        value={node.join || 'AND'}
                        onChange={(e) => onPatch({ join: e.target.value })}
                        disabled={disabled}
                        className="w-20 rounded-lg"
                    >
                        <NativeSelectOption value="AND">И</NativeSelectOption>
                        <NativeSelectOption value="OR">ИЛИ</NativeSelectOption>
                    </NativeSelect>
                )}
                <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!node.negate}
                        onChange={(e) => onPatch({ negate: e.target.checked })}
                        disabled={disabled}
                        className="h-3.5 w-3.5 accent-orange-600"
                    />
                    НЕ
                </label>
                <div className="flex-1 min-w-[220px]">
                    <SearchableSelect
                        groups={fieldGroups}
                        value={node.field}
                        onChange={changeField}
                        placeholder="Выберите поле..."
                        emptyText="Поля не найдены"
                        disabled={disabled}
                    />
                </div>
                <NativeSelect
                    value={node.op}
                    onChange={(e) => onPatch({ op: e.target.value, value: defaultValueFor(e.target.value) })}
                    disabled={disabled}
                    className="w-44 rounded-lg"
                >
                    {allowedOps.map((k) => (
                        <NativeSelectOption key={k} value={k}>{ops[k]?.label || k}</NativeSelectOption>
                    ))}
                </NativeSelect>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    disabled={disabled}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    title="Удалить условие"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {def && opNeedsValue(node.op) && (
                <div className="pl-1">
                    <ValueInput
                        def={def}
                        op={node.op}
                        value={node.value}
                        onChange={(value) => onPatch({ value })}
                        refOptions={refOptionsFor(def)}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
};

// ============================================================
// СПИСОК УСЛОВИЙ (рекурсивно, с вложенными группами)
// ============================================================
const ItemsEditor = ({ items, path, level, ctx }) => {
    const { onPatch, onRemove, onAddCond, onAddGroup, disabled } = ctx;

    return (
        <div className="space-y-2">
            {items.map((node, idx) => {
                const nodePath = [...path, idx];

                if (node.kind === 'group') {
                    return (
                        <div
                            key={idx}
                            className="space-y-2 rounded-lg border-2 border-dashed border-orange-200 bg-orange-50/40 p-2"
                        >
                            <div className="flex flex-wrap items-center gap-1.5">
                                {idx > 0 && (
                                    <NativeSelect
                                        value={node.join || 'AND'}
                                        onChange={(e) => onPatch(nodePath, { join: e.target.value })}
                                        disabled={disabled}
                                        className="w-20 rounded-lg"
                                    >
                                        <NativeSelectOption value="AND">И</NativeSelectOption>
                                        <NativeSelectOption value="OR">ИЛИ</NativeSelectOption>
                                    </NativeSelect>
                                )}
                                <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!node.negate}
                                        onChange={(e) => onPatch(nodePath, { negate: e.target.checked })}
                                        disabled={disabled}
                                        className="h-3.5 w-3.5 accent-orange-600"
                                    />
                                    НЕ
                                </label>
                                <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                                    Группа условий
                                </span>
                                <div className="ml-auto flex items-center gap-1">
                                    <Button
                                        type="button" variant="outline" size="sm"
                                        onClick={() => onAddCond(nodePath)} disabled={disabled}
                                        className="h-7 rounded-lg text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" />Условие
                                    </Button>
                                    <Button
                                        type="button" variant="outline" size="sm"
                                        onClick={() => onAddGroup(nodePath)} disabled={disabled}
                                        className="h-7 rounded-lg text-xs"
                                    >
                                        <FolderPlus className="h-3.5 w-3.5 mr-1" />Группа
                                    </Button>
                                    <Button
                                        type="button" variant="ghost" size="sm"
                                        onClick={() => onRemove(nodePath)} disabled={disabled}
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                        title="Удалить группу"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <ItemsEditor items={node.items || []} path={nodePath} level={level + 1} ctx={ctx} />
                        </div>
                    );
                }

                return (
                    <ConditionRow
                        key={idx}
                        node={node}
                        isFirst={idx === 0}
                        ctx={{
                            ...ctx,
                            onPatch: (patch) => onPatch(nodePath, patch),
                            onRemove: () => onRemove(nodePath),
                        }}
                    />
                );
            })}
            {items.length === 0 && (
                <p className="text-sm text-slate-400">Условий нет — добавьте условие или группу.</p>
            )}
        </div>
    );
};

// ============================================================
// СТРАНИЦА «ВЫБОРКА ВЫЗОВОВ»
// ============================================================
const CallSamplePage = () => {
    const navigate = useNavigate();
    const { has } = usePermissions();
    const canManage = has('call_samples.manage');

    const fieldsQuery = useSampleFields();
    const samplesQuery = useCallSamples();
    const saveMutation = useSaveCallSample();
    const deleteMutation = useDeleteCallSample();
    const previewMutation = usePreviewCallSample();

    const deptsQuery = useDepartments();
    const unitsQuery = useUnits();
    const unitTypesQuery = useUnitTypes();
    const munisQuery = useMunicipalities();
    const catsQuery = useFireCategories();
    const causesQuery = useFireCauses();
    const nonAccQuery = useFireNonaccountReasons();

    const [definition, setDefinition] = useState({ items: [newCondition('AND')] });
    const [sampleName, setSampleName] = useState('');
    const [loadedSampleId, setLoadedSampleId] = useState(null);
    const [loadedJson, setLoadedJson] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [previewTotal, setPreviewTotal] = useState(null);
    const [sampleToDelete, setSampleToDelete] = useState(null);

    const catalog = useMemo(
        () => fieldsQuery.data || { groups: [], ops: {} },
        [fieldsQuery.data]
    );
    const ops = catalog.ops || {};

    const fieldMap = useMemo(() => {
        const map = {};
        for (const g of catalog.groups || []) {
            for (const f of g.fields) map[f.key] = f;
        }
        return map;
    }, [catalog]);

    const fieldGroups = useMemo(
        () => (catalog.groups || []).map((g) => ({
            key: g.label,
            label: g.label,
            options: g.fields.map((f) => ({ value: f.key, label: f.label, search: f.label.toLowerCase() })),
        })),
        [catalog]
    );

    const refOptionsMap = useMemo(() => ({
        departments: asList(deptsQuery.data).map((d) => ({ value: d.id, label: d.name || d.full_name || d.id })),
        // Техника: подразделение · тип · название · номерной знак
        units: asList(unitsQuery.data).map((u) => {
            const parts = [
                u.department_name,
                u.type_short_name || u.type_name,
                u.name,
                u.plate_number ? `№ ${u.plate_number}` : null,
            ].filter(Boolean);
            return { value: u.id, label: parts.join(' · ') || u.id };
        }),
        unit_types: asList(unitTypesQuery.data).map((t) => ({ value: t.id, label: `${t.short_name ? `${t.short_name} — ` : ''}${t.name}` })),
        municipalities: asList(munisQuery.data).map((m) => ({ value: m.id, label: m.name })),
        fire_categories: asList(catsQuery.data).map((c) => ({ value: c.id, label: `${c.code ? `${c.code} ` : ''}${c.name}` })),
        fire_causes: asList(causesQuery.data).map((c) => ({ value: c.id, label: c.name })),
        fire_nonaccount: asList(nonAccQuery.data).map((c) => ({ value: c.id, label: c.name })),
    }), [
        deptsQuery.data, unitsQuery.data, unitTypesQuery.data, munisQuery.data,
        catsQuery.data, causesQuery.data, nonAccQuery.data,
    ]);

    const refOptionsFor = (def) => (def?.ref ? (refOptionsMap[def.ref] || []) : []);

    const ctx = {
        fieldMap,
        fieldGroups,
        ops,
        refOptionsFor,
        disabled: false,
        onPatch: (path, patch) => setDefinition((prev) => updateNodeAt(prev, path, (n) => ({ ...n, ...patch }))),
        onRemove: (path) => setDefinition((prev) => removeNodeAt(prev, path)),
        onAddCond: (parentPath) => setDefinition((prev) => insertNode(prev, parentPath, newCondition('AND'))),
        onAddGroup: (parentPath) => setDefinition((prev) => insertNode(prev, parentPath, newGroup('AND'))),
    };

    const samples = asList(samplesQuery.data);
    // Выборка не изменялась с момента загрузки — можно применить её по id
    const unchangedSaved = !!loadedSampleId && JSON.stringify(definition) === loadedJson;
    const fieldsLoading = fieldsQuery.isLoading;

    const handleSave = () => {
        const name = sampleName.trim();
        if (!name) {
            setError('Укажите название выборки');
            setNotice('');
            return;
        }
        setError('');
        setNotice('');
        saveMutation.mutate(
            { name, definition, id: loadedSampleId || undefined },
            {
                onSuccess: (res) => {
                    const saved = res?.data;
                    if (saved) {
                        setLoadedSampleId(saved.id);
                        setLoadedJson(JSON.stringify(saved.definition));
                        setSampleName(saved.name);
                    }
                    setNotice(`Выборка «${name}» сохранена`);
                },
                onError: (e) => setError(e?.response?.data?.error || 'Не удалось сохранить выборку'),
            }
        );
    };

    const handleLoad = (sample) => {
        const def = sample?.definition && Array.isArray(sample.definition.items)
            ? sample.definition
            : { items: [] };
        setDefinition(def);
        setSampleName(sample?.name || '');
        setLoadedSampleId(sample?.id || null);
        setLoadedJson(JSON.stringify(def));
        setPreviewTotal(null);
        setError('');
        setNotice(`Загружена выборка «${sample?.name || ''}»`);
    };

    const handleDelete = () => {
        const sample = sampleToDelete;
        if (!sample?.id) return;
        deleteMutation.mutate(sample.id, {
            onSuccess: () => {
                if (loadedSampleId === sample.id) {
                    setLoadedSampleId(null);
                    setLoadedJson(null);
                }
                setSampleToDelete(null);
            },
            onError: () => setSampleToDelete(null),
        });
    };

    const handlePreview = () => {
        if (!hasAnyCondition(definition.items)) {
            setError('Добавьте хотя бы одно заполненное условие');
            return;
        }
        setError('');
        previewMutation.mutate(
            { definition },
            {
                onSuccess: (data) => setPreviewTotal(data?.total ?? 0),
                onError: (e) => setError(e?.response?.data?.error || 'Не удалось проверить выборку'),
            }
        );
    };

    const handleShowResults = () => {
        if (!hasAnyCondition(definition.items)) {
            setError('Добавьте хотя бы одно заполненное условие');
            return;
        }
        setError('');
        if (unchangedSaved) {
            navigate(`/calls?sample_id=${loadedSampleId}&sample_name=${encodeURIComponent(sampleName || '')}`);
        } else {
            navigate(`/calls?cq=${encodeSampleDefinition(definition)}`);
        }
    };

    const handleReset = () => {
        setDefinition({ items: [newCondition('AND')] });
        setSampleName('');
        setLoadedSampleId(null);
        setLoadedJson(null);
        setPreviewTotal(null);
        setError('');
        setNotice('');
    };

    return (
        <div className="space-y-4">
            {/* Заголовок */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ListFilter className="h-6 w-6 text-orange-500" />
                        Выборка вызовов
                    </h1>
                    <p className="text-sm text-slate-400">
                        Конструктор запроса: условия, группы, операторы И / ИЛИ и НЕ
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleReset} className="rounded-lg">
                        <Undo2 className="h-4 w-4 mr-2" />Сбросить
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePreview}
                        disabled={previewMutation.isPending}
                        className="rounded-lg"
                    >
                        {previewMutation.isPending
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Search className="h-4 w-4 mr-2" />}
                        Проверить
                    </Button>
                    <Button
                        onClick={handleShowResults}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        <Play className="h-4 w-4 mr-2" />Показать вызовы
                    </Button>
                </div>
            </div>

            {previewTotal !== null && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Под выборку попадает вызовов: <span className="font-bold">{previewTotal}</span>
                </div>
            )}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
            {notice && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    {notice}
                </div>
            )}

            {/* Сохранённые выборки */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[3px_5px_11px_1px_#0000002e]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-700">Сохранённые выборки</h2>
                    <span className="text-xs text-slate-400">{samples.length} шт.</span>
                </div>
                {samplesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />Загрузка...
                    </div>
                ) : samples.length === 0 ? (
                    <p className="text-sm text-slate-400">Сохранённых выборок пока нет.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {samples.map((s) => (
                            <div
                                key={s.id}
                                className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                                    loadedSampleId === s.id
                                        ? 'border-orange-300 bg-orange-50'
                                        : 'border-slate-200 bg-white'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleLoad(s)}
                                    className="text-sm font-medium text-slate-700 hover:text-orange-600"
                                    title="Загрузить выборку"
                                >
                                    {s.name}
                                </button>
                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={() => setSampleToDelete(s)}
                                        className="text-red-400 hover:text-red-600"
                                        title="Удалить выборку"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {canManage && (
                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center">
                        <Input
                            value={sampleName}
                            onChange={(e) => setSampleName(e.target.value)}
                            placeholder="Название выборки..."
                            className="rounded-lg sm:flex-1"
                        />
                        <Button onClick={handleSave} disabled={saveMutation.isPending} className="rounded-lg">
                            {saveMutation.isPending
                                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                : <Save className="h-4 w-4 mr-2" />}
                            Сохранить
                        </Button>
                    </div>
                )}
            </div>

            {/* Конструктор условий */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[3px_5px_11px_1px_#0000002e]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-700">Условия запроса</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => ctx.onAddCond([])}
                            className="rounded-lg"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />Добавить условие
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => ctx.onAddGroup([])}
                            className="rounded-lg"
                        >
                            <FolderPlus className="h-3.5 w-3.5 mr-1" />Добавить группу
                        </Button>
                    </div>
                </div>

                {fieldsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />Загрузка полей...
                    </div>
                ) : (
                    <ItemsEditor items={definition.items} path={[]} level={0} ctx={ctx} />
                )}

                <p className="mt-3 text-xs text-slate-400">
                    «И / ИЛИ» задаёт связь условия с предыдущим, «НЕ» инвертирует условие,
                    группа объединяет условия в скобки.
                </p>
            </div>

            {/* Подтверждение удаления выборки */}
            <AlertDialog open={!!sampleToDelete} onOpenChange={(open) => !open && setSampleToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление выборки</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить выборку «{sampleToDelete?.name}»? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CallSamplePage;
