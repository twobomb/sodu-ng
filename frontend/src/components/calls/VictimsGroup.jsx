import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
import { Plus, Trash2 } from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

const emptyRow = (fields) => {
    const r = {};
    for (const f of fields) r[f.key] = '';
    return r;
};

// Универсальная графа «Пострадавшие».
// Поддерживает поля: text, number, date, textarea, select.
// Валидация: «в т.ч. детей» не может превышать общее количество.
// Проп `inline` — компактный режим: строки в одну линию (#N + поля + удалить),
//   без заголовка-полей "Всего/дети".
const VictimsGroup = ({
    title,
    totalKey,
    childrenKey,
    dataKey,
    shadow = '#fff0ca',
    fields,
    values = {},
    data = [],
    disabled,
    inline = false,
    onChangeValue,
    onChangeData,
}) => {
    const [pendingDelete, setPendingDelete] = useState(null);

    const total = values[totalKey];
    const children = totalKey ? values[childrenKey] : undefined;
    const totalNum = Number(total);
    const childrenNum = Number(children);
    const invalid =
        totalKey && childrenKey &&
        total !== '' && total != null &&
        children !== '' && children != null &&
        !isNaN(totalNum) && !isNaN(childrenNum) &&
        childrenNum > totalNum;

    const setRow = (idx, key, val) => {
        const next = [...data];
        next[idx] = { ...next[idx], [key]: val };
        onChangeData(dataKey, next);
    };
    const addRow = () => onChangeData(dataKey, [...data, emptyRow(fields)]);
    const confirmRemove = () => {
        if (pendingDelete == null) return;
        onChangeData(dataKey, data.filter((_, i) => i !== pendingDelete));
        setPendingDelete(null);
    };

    const renderField = (f, row, idx) => {
        const baseCls = 'rounded-lg';
        if (f.type === 'textarea') {
            return (
                <div key={f.key} className="sm:col-span-2">
                    <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                    <Textarea
                        rows={3}
                        value={row[f.key] || ''}
                        disabled={disabled}
                        onChange={(e) => setRow(idx, f.key, e.target.value)}
                        className={baseCls}
                        placeholder={f.placeholder || ''}
                    />
                </div>
            );
        }
        if (f.type === 'date') {
            return (
                <div key={f.key}>
                    <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                    <Input
                        type="date"
                        max={today}
                        value={row[f.key] || ''}
                        disabled={disabled}
                        onChange={(e) => setRow(idx, f.key, e.target.value)}
                        className={baseCls}
                    />
                </div>
            );
        }
        if (f.type === 'select') {
            return (
                <div key={f.key}>
                    <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                    <select
                        value={row[f.key] || ''}
                        disabled={disabled}
                        onChange={(e) => setRow(idx, f.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                        <option value="">—</option>
                        {(f.options || []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
            );
        }
        // text / number
        return inline ? (
            <Input
                key={f.key}
                value={row[f.key] ?? ''}
                disabled={disabled}
                onChange={(e) => setRow(idx, f.key, e.target.value)}
                className={`${baseCls} h-8 py-1`}
                placeholder={f.placeholder || f.label || ''}
            />
        ) : (
            <div key={f.key}>
                <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                <Input
                    value={row[f.key] ?? ''}
                    disabled={disabled}
                    onChange={(e) => setRow(idx, f.key, e.target.value)}
                    className={baseCls}
                    placeholder={f.placeholder || ''}
                />
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4" style={{ boxShadow: `inset 0px -1px 19px 0px ${shadow}` }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">{title}{totalKey ? ', чел.' : ''}</h3>
            </div>
            {totalKey && childrenKey && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Всего</Label>
                        <Input
                            type="number"
                            min="0"
                            value={total ?? ''}
                            disabled={disabled}
                            onChange={(e) => onChangeValue(totalKey, e.target.value)}
                            className="rounded-lg"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">в т.ч. детей</Label>
                        <Input
                            type="number"
                            min="0"
                            value={children ?? ''}
                            disabled={disabled}
                            onChange={(e) => onChangeValue(childrenKey, e.target.value)}
                            className={`rounded-lg ${invalid ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                        />
                    </div>
                </div>
            )}
            {invalid && (
                <p className="text-xs text-red-600 mt-1">
                    Количество детей не может превышать общее количество людей
                </p>
            )}

            <div className="mt-3 space-y-2">
                {data.map((row, idx) => (
                    inline ? (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <span className="text-xs font-semibold text-slate-400 shrink-0 w-5">#{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                {fields.map((f) => renderField(f, row, idx))}
                            </div>
                            {!disabled && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPendingDelete(idx)}
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 shrink-0"
                                    title="Удалить запись"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                                {!disabled && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPendingDelete(idx)}
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                        title="Удалить запись"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {fields.map((f) => renderField(f, row, idx))}
                            </div>
                        </div>
                    )
                ))}
                {!disabled && (
                    <Button variant="outline" size="sm" onClick={addRow} className="rounded-lg h-8 text-slate-600">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Добавить данные
                    </Button>
                )}
            </div>

            <AlertDialog open={pendingDelete != null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление записи</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы уверены, что хотите удалить запись #{pendingDelete != null ? pendingDelete + 1 : ''}? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemove}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VictimsGroup;