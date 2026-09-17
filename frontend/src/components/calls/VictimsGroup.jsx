import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

// Универсальная графа «Пострадавшие».
//  - totalKey / childrenKey — числовые поля «Всего» и «в т.ч. детей»
//  - dataKey — ключ JSON-массива данных (погибшие/травмированные/спасённые)
//  - fields — описание полей строки: [{ key, label, type: number|text|select, options }]
const emptyRow = (fields) => {
    const r = {};
    for (const f of fields) r[f.key] = f.type === 'number' ? '' : '';
    return r;
};

const VictimsGroup = ({
    title,
    totalKey,
    totalLabel,
    childrenKey,
    dataKey,
    fields,
    values = {},
    data = [],
    disabled,
    onChangeValue,
    onChangeData,
}) => {
    const setRow = (idx, key, val) => {
        const next = [...data];
        next[idx] = { ...next[idx], [key]: val };
        onChangeData(dataKey, next);
    };
    const addRow = () => onChangeData(dataKey, [...data, emptyRow(fields)]);
    const removeRow = (idx) => onChangeData(dataKey, data.filter((_, i) => i !== idx));

    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{totalLabel}</Label>
                    <Input
                        type="number"
                        min="0"
                        value={values[totalKey] ?? ''}
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
                        value={values[childrenKey] ?? ''}
                        disabled={disabled}
                        onChange={(e) => onChangeValue(childrenKey, e.target.value)}
                        className="rounded-lg"
                    />
                </div>
            </div>

            <div className="mt-2 space-y-2">
                {data.map((row, idx) => (
                    <div key={idx} className="rounded-md border border-slate-100 bg-slate-50/50 p-2 grid gap-2 sm:grid-cols-2">
                        {fields.map((f) => (
                            <div key={f.key} className="space-y-0.5">
                                <Label className="text-[11px] text-slate-400">{f.label}</Label>
                                {f.type === 'select' ? (
                                    <select
                                        value={row[f.key] || ''}
                                        disabled={disabled}
                                        onChange={(e) => setRow(idx, f.key, e.target.value)}
                                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    >
                                        <option value="">—</option>
                                        {(f.options || []).map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        type={f.type === 'number' ? 'number' : 'text'}
                                        value={row[f.key] ?? ''}
                                        disabled={disabled}
                                        onChange={(e) => setRow(idx, f.key, e.target.value)}
                                        className="rounded-md h-8"
                                        placeholder={f.placeholder || ''}
                                    />
                                )}
                            </div>
                        ))}
                        {!disabled && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRow(idx)}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 self-end"
                                title="Удалить запись"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                ))}
                {!disabled && (
                    <Button variant="outline" size="sm" onClick={addRow} className="rounded-lg h-8 text-slate-600">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Добавить данные
                    </Button>
                )}
            </div>
        </div>
    );
};

export default VictimsGroup;