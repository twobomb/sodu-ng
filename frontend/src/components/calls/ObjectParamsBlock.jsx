import { useMemo, useState } from 'react';
import {
    useObjectParams,
    useCreateObjectParam,
    useDeleteObjectParam,
    useCreateObjectParamValue,
    useDeleteObjectParamValue,
} from '../../hooks/useCalls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Trash2, ChevronDown } from 'lucide-react';

// Нормализация строки для сравнения без учёта регистра
const norm = (s) => String(s || '').trim().toLowerCase();

// Универсальное поле справочника: текстовый ввод + выпадающий список значений
// из справочника + ненавязчивая подсказка «добавить в справочник» (для тех,
// у кого есть право). Пользователь всегда может ввести произвольное значение.
const DictField = ({
    myKey,
    openKey,
    setOpenKey,
    value,
    onChange,
    placeholder,
    options = [],
    canManage = false,
    allowSuggest = true,
    onDeleteOption,
    onAddSuggestion,
    addHint = 'Добавить в справочник',
    disabled = false,
    listTitle = 'Справочник',
}) => {
    const open = openKey === myKey;
    // Не даём полю потерять фокус при клике по элементам списка (иначе dropdown
    // закрывается раньше, чем сработает клик).
    const keepFocus = (e) => e.preventDefault();

    const typed = String(value || '').trim();
    const exists = !!typed && options.some((o) => norm(o.label) === norm(typed));

    return (
        <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-1">
                <Input
                    value={value || ''}
                    disabled={disabled}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => { if (!disabled) setOpenKey(myKey); }}
                    onBlur={() => setOpenKey((k) => (k === myKey ? null : k))}
                    placeholder={placeholder}
                    className="flex-1 min-w-0 rounded-lg"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onMouseDown={keepFocus}
                    onClick={() => setOpenKey(open ? null : myKey)}
                    title="Справочник"
                    className="h-9 w-9 shrink-0 p-0 rounded-lg"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </Button>
            </div>
            {open && (
                <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-400">
                        {listTitle}
                    </div>
                    <div className="max-h-44 overflow-y-auto p-1">
                        {options.length === 0 && (
                            <p className="px-2 py-1 text-xs text-slate-400">Список пуст.</p>
                        )}
                        {options.map((o) => (
                            <div key={o.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-100">
                                <button
                                    type="button"
                                    onMouseDown={keepFocus}
                                    onClick={() => { onChange(o.label); setOpenKey(null); }}
                                    className="flex-1 min-w-0 text-left text-sm truncate hover:text-orange-600"
                                    title="Подставить значение"
                                >
                                    {o.label}
                                </button>
                                {canManage && (
                                    <button
                                        type="button"
                                        onMouseDown={keepFocus}
                                        onClick={() => onDeleteOption(o)}
                                        className="h-5 w-5 shrink-0 text-red-500 hover:text-red-700"
                                        title="Удалить из справочника"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {canManage && allowSuggest && typed && !exists && (
                        <div className="border-t border-slate-200 p-1">
                            <button
                                type="button"
                                onMouseDown={keepFocus}
                                onClick={() => onAddSuggestion(typed)}
                                className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                                title={addHint}
                            >
                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{addHint} «{typed}»</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// Блок «Объекты» карточки вызова.
// objects: [{ items: [{ param, value }] }]
// onChange(next) — обновляет список объектов в форме вызова.
// canManage — право управлять справочником параметров/значений.
// ============================================================
const ObjectParamsBlock = ({ objects, onChange, disabled = false, canManage = false }) => {
    const catalogQuery = useObjectParams();
    const createParam = useCreateObjectParam();
    const deleteParam = useDeleteObjectParam();
    const createValue = useCreateObjectParamValue();
    const deleteValue = useDeleteObjectParamValue();

    const [openKey, setOpenKey] = useState(null);
    const [error, setError] = useState('');
    const [objectToDelete, setObjectToDelete] = useState(null); // индекс объекта
    const [itemToDelete, setItemToDelete] = useState(null); // { oi, ii }
    const [paramToDelete, setParamToDelete] = useState(null); // { id, label }
    const [valueToDelete, setValueToDelete] = useState(null); // { id, label, param_name }

    const rows = Array.isArray(objects) ? objects : [];
    const catalog = catalogQuery.data || {};
    const allValues = Array.isArray(catalog.values) ? catalog.values : [];

    const paramOptions = useMemo(
        () => (Array.isArray(catalog.params) ? catalog.params : [])
            .map((p) => ({ id: p.id, label: p.name })),
        [catalog.params]
    );

    // Значения, привязанные к данному параметру (без учёта регистра)
    const valuesFor = (paramName) =>
        allValues
            .filter((v) => norm(v.param_name) === norm(paramName))
            .map((v) => ({ id: v.id, label: v.value, param_name: v.param_name }));

    // ---------- Изменение дерева объектов ----------
    const addObject = () => onChange([...rows, { items: [{ param: '', value: '' }] }]);
    const removeObject = (idx) => onChange(rows.filter((_, i) => i !== idx));
    const addItem = (oi) =>
        onChange(rows.map((o, i) =>
            i === oi ? { ...o, items: [...(o.items || []), { param: '', value: '' }] } : o));
    const removeItem = (oi, ii) =>
        onChange(rows.map((o, i) =>
            i === oi ? { ...o, items: (o.items || []).filter((_, j) => j !== ii) } : o));
    const setItem = (oi, ii, field, val) =>
        onChange(rows.map((o, i) =>
            i === oi
                ? { ...o, items: (o.items || []).map((it, j) => (j === ii ? { ...it, [field]: val } : it)) }
                : o));

    const confirmRemoveObject = () => {
        if (objectToDelete == null) return;
        removeObject(objectToDelete);
        setObjectToDelete(null);
    };
    const confirmRemoveItem = () => {
        if (!itemToDelete) return;
        removeItem(itemToDelete.oi, itemToDelete.ii);
        setItemToDelete(null);
    };

    // ---------- Справочник ----------
    const addParamToDict = (name) => {
        setError('');
        createParam.mutate(
            { name },
            { onError: (e) => setError(e?.response?.data?.error || 'Не удалось добавить параметр') }
        );
    };
    const addValueToDict = (paramName, value) => {
        if (!norm(paramName)) return;
        setError('');
        createValue.mutate(
            { param_name: paramName.trim(), value },
            { onError: (e) => setError(e?.response?.data?.error || 'Не удалось добавить значение') }
        );
    };
    const confirmRemoveParam = () => {
        if (!paramToDelete?.id) return;
        deleteParam.mutate(paramToDelete.id, { onSettled: () => setParamToDelete(null) });
    };
    const confirmRemoveValue = () => {
        if (!valueToDelete?.id) return;
        deleteValue.mutate(valueToDelete.id, { onSettled: () => setValueToDelete(null) });
    };

    const manage = canManage && !disabled;

    return (
        <div className="space-y-2">
            {rows.length === 0 && disabled && (
                <p className="text-sm text-slate-400">Объекты не указаны</p>
            )}
            {rows.map((obj, oi) => {
                const items = obj.items || [];
                // Дубли параметров внутри объекта (предупреждение, не блокировка)
                const dupIndexes = new Set();
                const seen = new Set();
                items.forEach((it, ii) => {
                    const key = norm(it.param);
                    if (key && seen.has(key)) dupIndexes.add(ii);
                    if (key) seen.add(key);
                });

                return (
                    <div key={oi} className="rounded-lg border border-slate-200 bg-white p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                                Объект {oi + 1}
                            </span>
                            {!disabled && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setObjectToDelete(oi)}
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                    title="Удалить объект"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {items.map((item, ii) => (
                                <div key={ii} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                    <DictField
                                        myKey={`${oi}-${ii}-p`}
                                        openKey={openKey}
                                        setOpenKey={setOpenKey}
                                        value={item.param || ''}
                                        onChange={(v) => setItem(oi, ii, 'param', v)}
                                        placeholder="Параметр"
                                        options={paramOptions}
                                        canManage={manage}
                                        onDeleteOption={(o) => setParamToDelete(o)}
                                        onAddSuggestion={addParamToDict}
                                        addHint="Добавить в справочник параметров"
                                        disabled={disabled}
                                        listTitle="Справочник параметров"
                                    />
                                    <DictField
                                        myKey={`${oi}-${ii}-v`}
                                        openKey={openKey}
                                        setOpenKey={setOpenKey}
                                        value={item.value || ''}
                                        onChange={(v) => setItem(oi, ii, 'value', v)}
                                        placeholder="Значение"
                                        options={valuesFor(item.param)}
                                        canManage={manage}
                                        allowSuggest={!!norm(item.param)}
                                        onDeleteOption={(o) => setValueToDelete(o)}
                                        onAddSuggestion={(v) => addValueToDict(item.param, v)}
                                        addHint="Добавить значение для параметра"
                                        disabled={disabled}
                                        listTitle={norm(item.param) ? `Значения для «${item.param}»` : 'Сначала укажите параметр'}
                                    />
                                    {!disabled && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setItemToDelete({ oi, ii })}
                                            className="h-9 w-9 shrink-0 p-0 text-red-500 hover:text-red-700"
                                            title="Удалить параметр"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    {dupIndexes.has(ii) && (
                                        <span className="text-[11px] text-amber-600 sm:hidden">
                                            Такой параметр уже есть в объекте
                                        </span>
                                    )}
                                </div>
                            ))}
                            {dupIndexes.size > 0 && (
                                <p className="hidden text-[11px] text-amber-600 sm:block">
                                    В объекте есть повторяющиеся параметры
                                </p>
                            )}
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addItem(oi)}
                                    className="rounded-lg"
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Добавить параметр
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
            {!disabled && (
                <Button type="button" variant="outline" size="sm" onClick={addObject} className="rounded-lg">
                    <Plus className="h-4 w-4 mr-1" /> Добавить объект
                </Button>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            {/* Подтверждение удаления объекта */}
            <AlertDialog open={objectToDelete != null} onOpenChange={(o) => { if (!o) setObjectToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление объекта</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить Объект {objectToDelete != null ? objectToDelete + 1 : ''} со всеми параметрами? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveObject} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Подтверждение удаления параметра объекта */}
            <AlertDialog open={!!itemToDelete} onOpenChange={(o) => { if (!o) setItemToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление параметра</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить параметр из Объекта {itemToDelete ? itemToDelete.oi + 1 : ''}? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveItem} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Подтверждение удаления параметра из справочника */}
            <AlertDialog open={!!paramToDelete} onOpenChange={(o) => { if (!o) setParamToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление параметра из справочника</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить параметр «{paramToDelete?.label || ''}» из справочника вместе с его значениями? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveParam} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Подтверждение удаления значения из справочника */}
            <AlertDialog open={!!valueToDelete} onOpenChange={(o) => { if (!o) setValueToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление значения из справочника</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить значение «{valueToDelete?.label || ''}»
                            {valueToDelete?.param_name ? ` для параметра «${valueToDelete.param_name}»` : ''} из справочника? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveValue} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ObjectParamsBlock;
