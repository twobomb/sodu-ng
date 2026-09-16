import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall, useUpdateCall, useSetCallStatus, useSetCallUnits, useAddCallEvent, useDeleteCallEvent } from '../../hooks/useCalls';
import { useUnits } from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { CALL_TYPES, CALL_RANKS, CALL_STATUS_META, CALL_STATUS_TRANSITIONS, nowLocalInput, toLocalInput, toIso, formatDateTime } from '../../lib/calls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/ui/searchable-select';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
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
import { ArrowLeft, Save, Plus, Trash2, Loader2, Siren } from 'lucide-react';

// Поля-даты вызова (в БД — timestamptz)
const DATETIME_FIELDS = [
    'incident_at',
    'message_received_at',
    'dispatch_at',
    'arrival_at',
    'localization_at',
    'open_fire_eliminated_at',
    'fire_eliminated_at',
];

const EMPTY_FORM = {
    type: '',
    rank: '',
    incident_at: '',
    message_received_at: '',
    municipality: '',
    address: '',
    dispatch_at: '',
    arrival_at: '',
    localization_at: '',
    open_fire_eliminated_at: '',
    fire_eliminated_at: '',
    description: '',
};

// Перевод данных с сервера (ISO) в значения формы (datetime-local / строки)
const fromServer = (call) => {
    const f = { ...EMPTY_FORM };
    for (const k of DATETIME_FIELDS) f[k] = toLocalInput(call?.[k]);
    for (const k of ['type', 'rank', 'municipality', 'address', 'description']) {
        f[k] = call?.[k] || '';
    }
    return f;
};

const DateTimeField = ({ id, label, value, onChange, disabled, onFocusSetNow }) => (
    <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
            id={id}
            type="datetime-local"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
                if (!value && !disabled) onFocusSetNow();
            }}
            className="rounded-lg"
        />
    </div>
);

// ============================================================
const CallDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { has } = usePermissions();

    const callQuery = useCall(id);
    const unitsQuery = useUnits();

    const updateCall = useUpdateCall();
    const setStatus = useSetCallStatus();
    const setUnits = useSetCallUnits();
    const addEvent = useAddCallEvent();
    const deleteEvent = useDeleteCallEvent();

    const call = callQuery.data;
    const callStatus = call?.status;

    const canChangeStatus = has('calls.update_status');
    const canEdit = callStatus === 'closed'
        ? has('calls.update_closed')
        : has('calls.update');

    // ---------- Форма (локальное редактирование) ----------
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [dirty, setDirty] = useState(false);

    // Синхронизируем с сервером, только если нет несохранённых локальных правок
    useEffect(() => {
        if (call && !dirty) {
            setFormData(fromServer(call));
        }
    }, [call, dirty]);

    const setField = (field, value) => {
        setDirty(true);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const setFieldNow = (field) => setField(field, nowLocalInput());

    const handleSave = () => {
        if (!call || updateCall.isPending) return;
        const payload = {
            type: formData.type || '',
            rank: formData.rank || '',
            municipality: formData.municipality || '',
            address: formData.address || '',
            description: formData.description || '',
        };
        for (const k of DATETIME_FIELDS) payload[k] = toIso(formData[k]);
        updateCall.mutate(
            { id, data: payload },
            {
                onSuccess: (res) => {
                    const updated = res?.data || res;
                    if (updated) setFormData(fromServer(updated));
                    setDirty(false);
                },
            }
        );
    };

    // ---------- Статус (с подтверждением) ----------
    const [statusConfirm, setStatusConfirm] = useState(null);

    const handleConfirmStatus = () => {
        if (!statusConfirm) return;
        setStatus.mutate({ id, status: statusConfirm.value });
        setStatusConfirm(null);
    };

    // ---------- Техника ----------
    const attachedUnits = call?.units || [];
    const attachedIds = new Set(attachedUnits.map((u) => u.unit_id));
    const availableUnits = Array.isArray(unitsQuery.data) ? unitsQuery.data : (unitsQuery.data?.data || []);
    const unitOptions = availableUnits
        .filter((u) => !attachedIds.has(u.id))
        .map((u) => ({
            value: u.id,
            label: u.name,
            extra: [u.type_short_name, u.plate_number, u.department_name].filter(Boolean).join(' · '),
        }));

    const handleAddUnit = (unitId) => {
        if (!unitId || !call || setUnits.isPending) return;
        if (attachedIds.has(unitId)) return;
        const next = [...attachedIds, unitId];
        setUnits.mutate({ id, unitIds: next });
    };

    const handleRemoveUnit = (unitId) => {
        if (!call || setUnits.isPending) return;
        const next = [...attachedIds].filter((x) => x !== unitId);
        setUnits.mutate({ id, unitIds: next });
    };

    // ---------- Ход событий ----------
    const [eventOpen, setEventOpen] = useState(false);
    const [eventAt, setEventAt] = useState(nowLocalInput());
    const [eventText, setEventText] = useState('');

    const openEventDialog = () => {
        setEventAt(nowLocalInput());
        setEventText('');
        setEventOpen(true);
    };

    const handleAddEvent = () => {
        if (!eventText.trim() || addEvent.isPending) return;
        addEvent.mutate(
            { id, data: { event_at: toIso(eventAt), text: eventText.trim() } },
            { onSuccess: () => setEventOpen(false) }
        );
    };

    // ---------- Загрузка ----------
    if (callQuery.isLoading && !call) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (callQuery.error && !call) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки вызова
            </div>
        );
    }

    if (!call) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Вызов не найден
            </div>
        );
    }

    const statusMeta = CALL_STATUS_META[call.status] || { label: call.status, badge: 'bg-slate-500' };
    const transitions = CALL_STATUS_TRANSITIONS[call.status] || [];

    return (
        <div className="space-y-4">
            {/* Шапка */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/calls')}
                        className="rounded-lg h-9 w-9 p-0"
                        title="К списку вызовов"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Siren className="h-6 w-6 text-red-500" />
                        Вызов
                    </h1>
                    <Badge className={`${statusMeta.badge} text-white`}>{statusMeta.label}</Badge>
                    {dirty && <Badge className="bg-amber-500 text-white">есть несохранённые изменения</Badge>}
                </div>
                <div className="flex items-center gap-2">
                    {canChangeStatus && transitions.map((t) => (
                        <Button
                            key={t.value}
                            variant="outline"
                            onClick={() => setStatusConfirm(t)}
                            className="rounded-lg"
                        >
                            {t.label}
                        </Button>
                    ))}
                    {canEdit && (
                        <Button
                            onClick={handleSave}
                            disabled={updateCall.isPending || !dirty}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {updateCall.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Сохранить
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* ---------- Левая колонка: форма ---------- */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Общая информация */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Общая информация</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DateTimeField id="incident_at" label="Дата и время возникновения события" value={formData.incident_at} onChange={(v) => setField('incident_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('incident_at')} />
                            <DateTimeField id="message_received_at" label="Время получения сообщения" value={formData.message_received_at} onChange={(v) => setField('message_received_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('message_received_at')} />
                            <div className="space-y-2">
                                <Label htmlFor="municipality">Муниципальный / городской округ</Label>
                                <Input id="municipality" placeholder="Например: городской округ ..." value={formData.municipality} onChange={(e) => setField('municipality', e.target.value)} disabled={!canEdit} className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Адрес места происшествия</Label>
                                <Input id="address" placeholder="Адрес" value={formData.address} onChange={(e) => setField('address', e.target.value)} disabled={!canEdit} className="rounded-lg" />
                            </div>
                            <DateTimeField id="dispatch_at" label="Время высылки сил и средств" value={formData.dispatch_at} onChange={(v) => setField('dispatch_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('dispatch_at')} />
                            <DateTimeField id="arrival_at" label="Время прибытия" value={formData.arrival_at} onChange={(v) => setField('arrival_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('arrival_at')} />
                        </div>
                    </div>

                    {/* Тип вызова */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Тип вызова</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="type">Тип вызова</Label>
                                <NativeSelect value={formData.type} onChange={(e) => setField('type', e.target.value)} disabled={!canEdit} className="w-full">
                                    <NativeSelectOption value="">Не указан</NativeSelectOption>
                                    {CALL_TYPES.map((t) => (
                                        <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                            {formData.type === 'Пожар' && (
                                <div className="space-y-2">
                                    <Label htmlFor="rank">Ранг</Label>
                                    <NativeSelect value={formData.rank} onChange={(e) => setField('rank', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Не указан</NativeSelectOption>
                                        {CALL_RANKS.map((r) => (
                                            <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>
                                        ))}
                                    </NativeSelect>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Основные этапы пожара */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Основные этапы</h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <DateTimeField id="localization_at" label="Локализация пожара" value={formData.localization_at} onChange={(v) => setField('localization_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('localization_at')} />
                            <DateTimeField id="open_fire_eliminated_at" label="Ликвидация открытого горения" value={formData.open_fire_eliminated_at} onChange={(v) => setField('open_fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('open_fire_eliminated_at')} />
                            <DateTimeField id="fire_eliminated_at" label="Ликвидация пожара" value={formData.fire_eliminated_at} onChange={(v) => setField('fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('fire_eliminated_at')} />
                        </div>
                    </div>

                    {/* Описание */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="space-y-2">
                            <Label htmlFor="description">Описание</Label>
                            <Textarea
                                id="description"
                                rows={4}
                                placeholder="Описание вызова..."
                                value={formData.description}
                                onChange={(e) => setField('description', e.target.value)}
                                disabled={!canEdit}
                                className="rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Привлекаемая техника */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Привлекаемая техника</h2>
                        {canEdit && (
                            <SearchableSelect
                                options={unitOptions}
                                value=""
                                onChange={handleAddUnit}
                                placeholder="Добавить технику..."
                                emptyText="Нет доступной техники"
                                renderOption={(o) => (
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm truncate">{o.label}</span>
                                        {o.extra && <span className="text-[11px] text-slate-400 truncate">{o.extra}</span>}
                                    </div>
                                )}
                            />
                        )}
                        {!canEdit && !attachedUnits.length && (
                            <p className="text-sm text-slate-400">Техника не привлекалась</p>
                        )}
                        {attachedUnits.map((u) => (
                            <div key={u.unit_id} className="flex items-center justify-between gap-2 mt-2 rounded-lg border border-slate-200 px-3 py-2">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{u.unit_name}</span>
                                    <span className="text-[11px] text-slate-400 truncate">
                                        {[u.type_short_name, u.plate_number, u.department_name].filter(Boolean).join(' · ') || '—'}
                                    </span>
                                </div>
                                {canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveUnit(u.unit_id)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                        title="Убрать технику"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ---------- Правая колонка: ход событий ---------- */}
                <div className="rounded-xl border border-slate-200 p-4 self-start">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700">Ход событий</h2>
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={openEventDialog} className="rounded-lg h-8">
                                <Plus className="h-4 w-4 mr-1" />
                                Добавить
                            </Button>
                        )}
                    </div>
                    {call.events.length === 0 && (
                        <p className="text-sm text-slate-400">Событий пока нет</p>
                    )}
                    <div className="space-y-3 max-h-[60vh] overflow-auto">
                        {call.events.map((ev) => (
                            <div key={ev.id} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                                        {formatDateTime(ev.event_at)}
                                    </span>
                                    {canEdit && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteEvent.mutate({ id, eventId: ev.id })}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                            title="Удалить событие"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap mt-1">{ev.text}</p>
                                <span className="text-[11px] text-slate-400">{ev.author_username || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Диалог добавления события */}
            <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Добавить ход событий</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="event_at">Дата и время</Label>
                            <Input
                                id="event_at"
                                type="datetime-local"
                                value={eventAt}
                                onChange={(e) => setEventAt(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event_text">Описание хода</Label>
                            <Textarea
                                id="event_text"
                                rows={4}
                                placeholder="Например: локализация пожара.."
                                value={eventText}
                                onChange={(e) => setEventText(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEventOpen(false)} className="rounded-lg">
                            Отмена
                        </Button>
                        <Button type="button" onClick={handleAddEvent} disabled={addEvent.isPending || !eventText.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            {addEvent.isPending ? 'Сохранение...' : 'Добавить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог подтверждения смены статуса */}
            <AlertDialog open={!!statusConfirm} onOpenChange={(o) => { if (!o) setStatusConfirm(null); }}>
                {statusConfirm && (
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Смена статуса вызова</AlertDialogTitle>
                            <AlertDialogDescription>
                                {statusConfirm.description}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleConfirmStatus}
                                className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                {statusConfirm.label}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>
        </div>
    );
};

export default CallDetail;