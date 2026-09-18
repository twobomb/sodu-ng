import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Loader2, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

const callLabel = (c) => {
    const parts = [];
    if (c.incident_at) {
        parts.push(format(new Date(c.incident_at), 'dd.MM.yyyy HH:mm', { locale: ru }));
    }
    if (c.type) parts.push(c.type);
    if (c.address) parts.push(c.address);
    if (c.municipality_name) parts.push(c.municipality_name);
    return parts.join(' · ') || '';
};

// Собственный селект вызова с поиском и возможностью сбросить («Не выбрано»).
// Рендерится внутри диалога (не через portal), поэтому всегда кликабелен.
const InlineCallSelect = ({ options, value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const selected = options.find((o) => o.value === value) || null;

    const filtered = useMemo(() => {
        if (!q.trim()) return options;
        const s = q.toLowerCase();
        return options.filter((o) => (o.label || '').toLowerCase().includes(s) || (o.search || '').toLowerCase().includes(s));
    }, [options, q]);

    return (
        <div className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(!open)}
                className={`w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className={`flex items-center gap-2 truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selected && selected.color ? (
                        <span
                            className="inline-block h-3 w-3 shrink-0 rounded-sm border border-slate-300"
                            style={{ backgroundColor: selected.color }}
                        />
                    ) : null}
                    {selected && selected.code ? (
                        <span className="shrink-0 text-slate-400">{selected.code}</span>
                    ) : null}
                    <span className={`truncate ${selected ? 'text-slate-600' : 'text-slate-400'}`}>{selected ? selected.label : 'Выберите вызов...'}</span>
                </span>
                {selected ? (
                    <span
                        className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-slate-200 hover:bg-red-200 flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setQ(''); onChange(''); }}
                        title="Не выбрано"
                    >
                        <X className="h-3 w-3 text-slate-600" />
                    </span>
                ) : null}
                <ChevronDown className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </button>

            {open && (
                <div className="absolute left-0 z-50 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    <input
                        autoFocus
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Поиск вызова..."
                        className="w-full px-3 py-1.5 text-sm border-b border-slate-200 focus:outline-none"
                    />
                    <div className="divide-y divide-slate-100">
                        {filtered.length === 0 && (
                            <div className="px-3 py-3 text-xs text-slate-500">Ничего не найдено</div>
                        )}
                        {filtered.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                className="flex items-start gap-2 w-full text-left px-3 py-2 text-sm hover:bg-slate-100 whitespace-pre-wrap break-words"
                            >
                                {o.color ? (
                                    <span
                                        className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300"
                                        style={{ backgroundColor: o.color }}
                                    />
                                ) : null}
                                {o.code ? <span className="shrink-0 text-slate-400">{o.code}</span> : null}
                                <span className="text-slate-600">{o.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Диалог смены статуса техники.
// Если выбран выездной статус — появляется выбор вызова (с поиском);
// галочка «Добавить действие в ход событий» — только когда вызов выбран.
const UnitStatusDialog = ({
    open,
    onOpenChange,
    unitName,
    statuses,
    calls = [],
    currentStatusId,
    defaultCallId = '',
    onSubmit,
    pending,
    error,
}) => {
    const [statusId, setStatusId] = useState(currentStatusId || '');
    const [callId, setCallId] = useState(defaultCallId || '');
    const [addEvent, setAddEvent] = useState(true);

    const selStatus = statuses.find((s) => s.id === statusId);
    const isDispatch = selStatus?.group_kind === 'dispatch';

    const callOptions = useMemo(
        () =>
            calls.map((c) => {
                const lab = callLabel(c);
                const full = c.call_code ? `${c.call_code} ${lab}` : lab;
                return {
                    value: c.id,
                    label: lab,
                    search: full.toLowerCase(),
                    code: c.call_code || '',
                    color: c.color || null,
                };
            }),
        [calls]
    );

    const handleSubmit = () => {
        if (!statusId) return;
        onSubmit({
            status_id: statusId,
            call_id: isDispatch ? (callId || null) : null,
            add_event: isDispatch ? addEvent : false,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg">Смена статуса: {unitName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Статус</Label>
                        <NativeSelect value={statusId} onChange={(e) => setStatusId(e.target.value)} className="w-full">
                            <NativeSelectOption value="">—</NativeSelectOption>
                            {statuses.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                        </NativeSelect>
                    </div>

                    {isDispatch && (
                        <div className="space-y-2">
                            <Label>Вызов (необязательно)</Label>
                            <InlineCallSelect
                                options={callOptions}
                                value={callId}
                                onChange={setCallId}
                                disabled={pending}
                            />
                            {callId && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addEvent}
                                        onChange={(e) => setAddEvent(e.target.checked)}
                                        className="h-4 w-4 accent-orange-600"
                                    />
                                    <span className="text-sm text-slate-700">Добавить действие в ход событий</span>
                                </label>
                            )}
                        </div>
                    )}

                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Отмена</Button>
                    <Button
                        type="button"
                        disabled={!statusId || pending}
                        onClick={handleSubmit}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Применить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnitStatusDialog;