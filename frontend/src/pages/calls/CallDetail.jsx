import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useCall, useMunicipalities, useUpdateCall, useSetCallStatus, useSetCallUnits, useAddCallEvent, useDeleteCallEvent, useCallDepartments, useSetCallDepartments } from '../../hooks/useCalls';
import { useUnits, useUnitStatuses, useChangeUnitStatus, useAvailableCalls } from '../../hooks/useUnits';
import { useDepartments } from '../../hooks/useDepartments';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useFireCategories, useFireCauses, useFireNonaccountReasons } from '../../hooks/useDictionaries';
import { CALL_TYPES, CALL_RANKS, CALL_STATUS_META, CALL_STATUS_TRANSITIONS, AREA_TYPES, nowLocalInput, toLocalInput, toIso, formatDateTime } from '../../lib/calls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/ui/searchable-select';
import UnitStatusDialog from '@/components/units/UnitStatusDialog';
import AddressAutocomplete from '@/components/calls/AddressAutocomplete';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import VictimsGroup from '../../components/calls/VictimsGroup';
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
import { ArrowLeft, Save, Plus, Trash2, Loader2, Siren, User, ChevronDown, Shield, Search } from 'lucide-react';

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

// Поля-числа пострадавших
const VICTIM_NUMBER_FIELDS = [
    'victims_dead_total', 'victims_dead_children',
    'victims_injured_total', 'victims_injured_children',
    'victims_rescued_total', 'victims_rescued_children',
    'victims_evacuated_total', 'victims_evacuated_children',
];
// Поля-данные пострадавших (jsonb)
const VICTIM_DATA_FIELDS = [
    'victims_dead_data',
    'victims_injured_data',
    'victims_rescued_data',
];

const EMPTY_FORM = {
    type: 'Пожар',
    rank: '',
    incident_at: '',
    message_received_at: '',
    municipality_id: '',
    address: '',
    dispatch_at: '',
    arrival_at: '',
    localization_at: '',
    open_fire_eliminated_at: '',
    fire_eliminated_at: '',
    description: '',
    fire_area: '',
    area_type: 'urban',
    fire_category_id: '',
    fire_cause_id: '',
    fire_cause_other: '',
    not_accounted_fire: false,
    not_accounted_reason_id: '',
    victims_dead_total: '', victims_dead_children: '', victims_dead_data: [],
    victims_injured_total: '', victims_injured_children: '', victims_injured_data: [],
    victims_rescued_total: '', victims_rescued_children: '', victims_rescued_data: [],
    victims_evacuated_total: '', victims_evacuated_children: '',
};

// Перевод данных с сервера (ISO) в значения формы (datetime-local / строки)
const fromServer = (call) => {
    const f = { ...EMPTY_FORM };
    for (const k of DATETIME_FIELDS) f[k] = toLocalInput(call?.[k]);
    f.type = call?.type || 'Пожар';
    f.rank = call?.rank || '';
    f.municipality_id = call?.municipality_id || '';
    f.address = call?.address || '';
    f.description = call?.description || '';
    f.fire_area = call?.fire_area ?? '';
    f.area_type = call?.area_type || 'urban';
    f.fire_category_id = call?.fire_category_id || '';
    f.fire_cause_id = call?.fire_cause_id || '';
    f.fire_cause_other = call?.fire_cause_other || '';
    f.not_accounted_fire = !!call?.not_accounted_fire;
    f.not_accounted_reason_id = call?.not_accounted_reason_id || '';
    for (const k of VICTIM_NUMBER_FIELDS) f[k] = call?.[k] ?? '';
    for (const k of VICTIM_DATA_FIELDS) f[k] = Array.isArray(call?.[k]) ? call[k] : [];
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
            onFocus={() => { if (!value && !disabled) onFocusSetNow(); }}
            className="rounded-lg"
        />
    </div>
);

const HOSP_OPTIONS = [
    { value: 'Госпитализация', label: 'Госпитализация' },
    { value: 'Амбулаторно', label: 'Амбулаторно' },
];

// ---------- КОНФИГУРАЦИЯ ГРАФ ПОСТРАДАВШИХ ----------
const VICTIM_GROUPS = [
    {
        title: 'Погибло людей',
        totalKey: 'victims_dead_total',
        childrenKey: 'victims_dead_children',
        dataKey: 'victims_dead_data',
        shadow: '#ffcaca',
        fields: [
            { key: 'fio', label: 'ФИО' },
            { key: 'birth_date', label: 'Дата рождения', type: 'date' },
        ],
    },
    {
        title: 'Травмировано людей',
        totalKey: 'victims_injured_total',
        childrenKey: 'victims_injured_children',
        dataKey: 'victims_injured_data',
        shadow: '#fff0ca',
        fields: [
            { key: 'fio', label: 'ФИО' },
            { key: 'birth_date', label: 'Дата рождения', type: 'date' },
            { key: 'diagnosis', label: 'Диагноз', type: 'textarea', placeholder: 'Диагноз...' },
            { key: 'hospitalization', label: 'Госпитализация', type: 'select', options: HOSP_OPTIONS },
            { key: 'hospital', label: 'Больница / амбулаторно', placeholder: 'Больница' },
        ],
    },
    {
        title: 'Спасено людей',
        totalKey: 'victims_rescued_total',
        childrenKey: 'victims_rescued_children',
        dataKey: 'victims_rescued_data',
        shadow: '#caffcc',
        fields: [
            { key: 'fio', label: 'ФИО' },
            { key: 'birth_date', label: 'Дата рождения', type: 'date' },
        ],
    },
];

// Кастомный выпадающий список для длинных формулировок: перенос строк + разделители
const LongOptionsSelect = ({ value, options, onChange, disabled, placeholder = 'Выберите...' }) => {
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.value === value);
    return (
        <div className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(!open)}
                className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
                <span className={`block truncate ${!selected ? 'text-slate-400' : 'text-slate-700'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown className="h-4 w-4 absolute right-3 top-2.5 text-slate-400" />
            </button>
            {open && (
                <div className="absolute inset-x-0 left-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {options.map((o, idx) => (
                        <div
                            key={o.value}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={`block w-full text-left px-3 py-2 text-sm cursor-pointer whitespace-pre-wrap break-words hover:bg-slate-100 ${idx < options.length - 1 ? 'border-b border-slate-200' : ''}`}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Панель управления статусом и привязкой техники в карточке вызова
const fmtDur = (a, b) => {
    if (!a || !b) return null;
    const d = new Date(b) - new Date(a);
    if (isNaN(d)) return null;
    if (d < 0) return 'время выезда позже прибытия';
    return `${Math.floor(d / 3600000)} ч ${Math.floor((d % 3600000) / 60000)} мин`;
};

const UnitCallControl = ({ unit, statuses, calls, canEdit, currentCallId, onRemove, onSubmitStatus, onSubmitDates, pending, error }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const baseDispatch = toLocalInput(unit.dispatch_at);
    const baseArrival = toLocalInput(unit.arrival_at);
    const [dispatchAt, setDispatchAt] = useState(baseDispatch);
    const [arrivalAt, setArrivalAt] = useState(baseArrival);
    const durTxt = fmtDur(dispatchAt, arrivalAt);
    const datesInvalid = !!dispatchAt && !!arrivalAt && new Date(arrivalAt) <= new Date(dispatchAt);
    const attachedHere = !!currentCallId && unit.call_id === currentCallId;
    // даты изменились относительно серверных
    const datesDirty = dispatchAt !== baseDispatch || arrivalAt !== baseArrival;

    // Синхронизация с сервером (если даты меняет другой пользователь)
    useEffect(() => {
        setDispatchAt(baseDispatch);
        setArrivalAt(baseArrival);
    }, [baseDispatch, baseArrival]);

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{unit.unit_name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{[unit.type_short_name, unit.plate_number, unit.department_name].filter(Boolean).join(' · ') || '—'}</div>
                    {attachedHere && <div className="text-[11px] text-orange-600 font-medium">привязана к этому вызову</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {canEdit ? (
                        <Button size="sm" onClick={() => setDialogOpen(true)} className="rounded-lg text-white transition-all hover:opacity-85 hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 hover:scale-[1.03] cursor-pointer" style={{ backgroundColor: unit.unit_status_color || '#64748b' }}>
                            {unit.unit_status_name || 'Сменить статус'}
                        </Button>
                    ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded text-white" style={{ backgroundColor: unit.unit_status_color || '#64748b' }}>{unit.unit_status_name || '—'}</span>
                    )}
                    {onRemove && !pending && (
                        <Button variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Убрать технику"><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Время выезда</Label>
                    <Input type="datetime-local" value={dispatchAt} disabled={!canEdit || pending} onChange={(e) => setDispatchAt(e.target.value)} onFocus={() => { if (!dispatchAt && canEdit) setDispatchAt(nowLocalInput()); }} className="rounded-lg" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Время прибытия</Label>
                    <Input type="datetime-local" value={arrivalAt} disabled={!canEdit || pending} onChange={(e) => setArrivalAt(e.target.value)} onFocus={() => { if (!arrivalAt && canEdit) setArrivalAt(nowLocalInput()); }} className={`rounded-lg ${datesInvalid ? 'border-red-400 ring-1 ring-red-300' : ''}`} />
                </div>
                {durTxt && !datesInvalid && <div className="sm:col-span-2 text-xs text-emerald-600 font-medium">Время в дороге: {durTxt}</div>}
                {datesInvalid && <div className="sm:col-span-2 text-xs text-red-600">Время выезда должно быть раньше времени прибытия</div>}
                {canEdit && (
                    <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                        <Button size="sm" onClick={() => onSubmitDates(unit, { dispatch_at: toIso(dispatchAt), arrival_at: toIso(arrivalAt) })} disabled={pending || datesInvalid || !datesDirty} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {pending ? 'Сохранение...' : 'Сохранить даты'}
                        </Button>
                        {error && <span className="text-xs text-red-600">{error}</span>}
                    </div>
                )}
            </div>

            <UnitStatusDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                unitName={unit.unit_name}
                statuses={statuses}
                calls={calls}
                currentStatusId={unit.status_id}
                defaultCallId={currentCallId}
                pending={pending}
                error={error}
                onSubmit={(p) => {
                    onSubmitStatus({ ...p, unit_id: unit.unit_id, dispatch_at: toIso(dispatchAt), arrival_at: toIso(arrivalAt) });
                    setDialogOpen(false);
                }}
            />
        </div>
    );
};

// ============================================================
const CallDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { has } = usePermissions();

    const callQuery = useCall(id);
    const munisQuery = useMunicipalities();
    const unitsQuery = useUnits();
    const unitStatusesQuery = useUnitStatuses();
    const availableCallsQuery = useAvailableCalls();
    const changeUnitStatus = useChangeUnitStatus();

    const { user } = useAuth();
    const deptsQuery = useDepartments();
    const callDeptsQuery = useCallDepartments(id);
    const setCallDepts = useSetCallDepartments();

    const [accessOpen, setAccessOpen] = useState(false);
    const [accessSearch, setAccessSearch] = useState('');
    const [accessSelected, setAccessSelected] = useState([]);
    // Ошибка сохранения статуса/дат — точечно для конкретной техники
    const [unitErr, setUnitErr] = useState(null); // { unitId, message }

    useEffect(() => {
        if (accessOpen && Array.isArray(callDeptsQuery.data)) {
            setAccessSelected(callDeptsQuery.data.map((d) => d.id));
        }
    }, [accessOpen, callDeptsQuery.data]);

    // Если доступ к карточке отозвали, пока пользователь её открывал — возвращаем в список
    useEffect(() => {
        const status = callQuery.error?.response?.status;
        if (status === 403 || status === 404) {
            navigate('/calls');
        }
    }, [callQuery.error, navigate]);
    const catsQuery = useFireCategories();
    const causesQuery = useFireCauses();
    const nonAccQuery = useFireNonaccountReasons();

    const updateCall = useUpdateCall();
    const setStatus = useSetCallStatus();
    const setUnits = useSetCallUnits();
    const addEvent = useAddCallEvent();
    const deleteEvent = useDeleteCallEvent();

    const call = callQuery.data;
    const callStatus = call?.status;

    const canChangeStatus = has('calls.update_status') &&
        (callStatus !== 'closed' || has('calls.update_closed'));
    const canEdit = callStatus === 'closed'
        ? has('calls.update_closed')
        : has('calls.update');

    // ---------- Форма (локальное редактирование) ----------
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [dirty, setDirty] = useState(false);
    const [formError, setFormError] = useState('');
    const [flashId, setFlashId] = useState(null);

    // Подсветка новых событий (добавленных этим пользователем или другими)
    const [flashEvents, setFlashEvents] = useState([]);
    const prevEventsRef = useRef([]);
    useEffect(() => {
        if (!call || !Array.isArray(call.events)) return;
        const currentIds = call.events.map((e) => e.id);
        const prevIds = prevEventsRef.current;
        if (prevIds.length > 0) {
            const newIds = currentIds.filter((id) => !prevIds.includes(id));
            if (newIds.length) {
                setFlashEvents((prev) => [...prev, ...newIds]);
                const t = setTimeout(
                    () => setFlashEvents((prev) => prev.filter((id) => !newIds.includes(id))),
                    3000
                );
                prevEventsRef.current = currentIds;
                return () => clearTimeout(t);
            }
        }
        prevEventsRef.current = currentIds;
    }, [call?.events]);

    useEffect(() => {
        if (call && !dirty) {
            setFormData(fromServer(call));
        }
    }, [call, dirty]);

    // Автосброс подсветки проблемного поля
    useEffect(() => {
        if (!flashId) return;
        const t = setTimeout(() => setFlashId(null), 2500);
        return () => clearTimeout(t);
    }, [flashId]);

    // Подсветка и фокус проблемного поля по тексту ошибки сервера
    const handleSaveError = (err) => {
        const msg = err?.response?.data?.error || 'Ошибка сохранения';
        setFormError(msg);
        const m = msg.match(/^"([^"]+)"/);
        const field = m ? m[1] : null;
        if (field) {
            const root = field.split('[')[0];
            const id = root.startsWith('victims_') ? 'victims-block' : root;
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setFlashId(id);
            }
        }
    };

    const setField = (field, value) => {
        setDirty(true);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };
    const setFieldNow = (field) => setField(field, nowLocalInput());
    const handleNumber = (field) => (e) => {
        setField(field, e.target.value === '' ? '' : Number(e.target.value));
    };

    // ---------- Справочники ----------
    const fireCats = Array.isArray(catsQuery.data) ? catsQuery.data : [];
    const fireCauses = Array.isArray(causesQuery.data) ? causesQuery.data : [];
    const nonAccReasons = Array.isArray(nonAccQuery.data) ? nonAccQuery.data : [];

    const catsById = useMemo(() => {
        const m = {};
        for (const c of fireCats) m[c.id] = c;
        return m;
    }, [fireCats]);

    const catsByParent = useMemo(() => {
        const m = {};
        for (const c of fireCats) {
            const pid = c.parent_id || '__ROOT__';
            if (!m[pid]) m[pid] = [];
            m[pid].push(c);
        }
        for (const k in m) m[k].sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'ru') || String(a.name).localeCompare(String(b.name), 'ru'));
        return m;
    }, [fireCats]);

    // Каскад: выбранные категории [lvl1, lvl2, lvl3]
    const catPath = useMemo(() => {
        const cid = formData.fire_category_id;
        if (!cid || !catsById[cid]) return [];
        const arr = [];
        let node = catsById[cid];
        while (node) {
            arr.unshift(node);
            node = node.parent_id ? catsById[node.parent_id] : null;
        }
        return arr;
    }, [formData.fire_category_id, catsById]);

    const cat1 = catPath[0];
    const cat2 = catPath[1];
    const cat3 = catPath[2];
    const cat2Options = cat1 ? (catsByParent[cat1.id] || []) : [];
    const cat3Options = cat2 ? (catsByParent[cat2.id] || []) : [];

    const handleCategoryChange = (cid) => setField('fire_category_id', cid);

    const causeOptions = fireCauses.map((c) => ({ value: c.id, label: c.name }));
    const selectedCause = fireCauses.find((c) => c.id === formData.fire_cause_id);
    const isOtherCause = selectedCause && selectedCause.name.includes('Иные причины');

    // ---------- Сохранение ----------
    const handleSave = () => {
        if (!call || updateCall.isPending) return;
        const payload = {
            type: formData.type || 'Пожар',
            rank: formData.rank || '',
            municipality_id: formData.municipality_id ? formData.municipality_id : null,
            address: formData.address || '',
            description: formData.description || '',
            fire_area: formData.fire_area === '' || formData.fire_area === null ? null : Number(formData.fire_area),
            area_type: formData.area_type || 'urban',
            fire_category_id: formData.fire_category_id || null,
            fire_cause_id: formData.fire_cause_id || null,
            fire_cause_other: formData.fire_cause_other || '',
            not_accounted_fire: !!formData.not_accounted_fire,
            not_accounted_reason_id: formData.not_accounted_reason_id || null,
        };
        for (const k of DATETIME_FIELDS) payload[k] = toIso(formData[k]);
        for (const k of VICTIM_NUMBER_FIELDS) {
            payload[k] = formData[k] === '' || formData[k] === null ? null : Number(formData[k]);
        }
        for (const k of VICTIM_DATA_FIELDS) payload[k] = formData[k] || [];

        updateCall.mutate(
            { id, data: payload },
            {
                onSuccess: (res) => {
                    const updated = res?.data || res;
                    if (updated) setFormData(fromServer(updated));
                    setDirty(false);
                    setFormError('');
                },
                onError: handleSaveError,
            }
        );
    };

    // ---------- Валидация пострадавших ----------
    const victimsInvalid = VICTIM_NUMBER_FIELDS.some((key, i) => {
        if (i % 2 !== 1) return false; // только children-поля
        const totalKey = VICTIM_NUMBER_FIELDS[i - 1];
        const total = Number(formData[totalKey]);
        const child = Number(formData[key]);
        return !isNaN(total) && !isNaN(child) && total > 0 && child > total;
    });

    // ---------- Статус (с подтверждением) ----------
    const [statusConfirm, setStatusConfirm] = useState(null);
    const handleConfirmStatus = () => {
        if (!statusConfirm) return;
        setStatus.mutate({ id, status: statusConfirm.value });
        setStatusConfirm(null);
    };

    // ---------- Техника ----------
    const [unitToRemove, setUnitToRemove] = useState(null);
    const attachedUnits = call?.units || [];
    const attachedIds = new Set(attachedUnits.map((u) => u.unit_id));
    const availableUnits = Array.isArray(unitsQuery.data) ? unitsQuery.data : (unitsQuery.data?.data || []);
    const unitOptions = availableUnits
        .filter((u) => !attachedIds.has(u.id))
        .map((u) => ({ value: u.id, label: u.name, extra: [u.type_short_name, u.plate_number, u.department_name].filter(Boolean).join(' · ') }));

    const allStatuses = Array.isArray(unitStatusesQuery.data) ? unitStatusesQuery.data : [];
    const availableCallsRows = Array.isArray(availableCallsQuery.data) ? availableCallsQuery.data : [];

    const deptsRaw = deptsQuery.data;
    const allDepts = Array.isArray(deptsRaw) ? deptsRaw : (deptsRaw?.data || []);
    const userDeptIds = user?.department_ids || (user?.departments || []).map((d) => d.id) || [];
    const accessibleDepts = user?.can_view_all
        ? allDepts
        : allDepts.filter((d) => userDeptIds.includes(d.id));
    const filteredDepts = accessibleDepts.filter(
        (d) => !accessSearch.trim() || String(d.name || '').toLowerCase().includes(accessSearch.toLowerCase())
    );

    const handleApplyUnitStatus = (payload) => {
        const { unit_id, ...data } = payload;
        setUnitErr(null);
        changeUnitStatus.mutate(
            { id: unit_id, data },
            { onError: (e) => setUnitErr({ unitId: unit_id, message: e?.response?.data?.error || 'Ошибка' }) }
        );
    };

    const handleApplyUnitDates = (unit, dates) => {
        // Сохраняем даты через единый endpoint смены статуса (текущий статус техники)
        const id = unit.unit_id;
        setUnitErr(null);
        changeUnitStatus.mutate(
            {
                id,
                data: {
                    status_id: unit.status_id || null,
                    call_id: call.id,
                    dispatch_at: dates.dispatch_at,
                    arrival_at: dates.arrival_at,
                    add_event: false,
                },
            },
            { onError: (e) => setUnitErr({ unitId: id, message: e?.response?.data?.error || 'Ошибка' }) }
        );
    };

    const handleAddUnit = (unitId) => {
        if (!unitId || !call || setUnits.isPending) return;
        if (attachedIds.has(unitId)) return;
        setUnits.mutate({ id, unitIds: [...attachedIds, unitId] });
    };
    const confirmRemoveUnit = () => {
        if (!unitToRemove) return;
        const next = [...attachedIds].filter((x) => x !== unitToRemove);
        setUnits.mutate({ id, unitIds: next });
        setUnitToRemove(null);
    };

    // ---------- Ход событий ----------
    const [eventOpen, setEventOpen] = useState(false);
    const [eventAt, setEventAt] = useState(nowLocalInput());
    const [eventText, setEventText] = useState('');
    const [eventToDelete, setEventToDelete] = useState(null);

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

    // ---------- Уход со страницы с несохранёнными данными ----------
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            dirty && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (!dirty) return;
        const handler = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

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

    const statusMeta = CALL_STATUS_META[call.status] || { label: call.status, badge: 'bg-slate-500 dark:bg-slate-500/40' };
    const transitions = CALL_STATUS_TRANSITIONS[call.status] || [];

    const munisList = Array.isArray(munisQuery.data) ? munisQuery.data : (munisQuery.data?.data || []);
    const municipalityOptions = munisList.map((m) => ({ value: m.id, label: m.name, extra: m.department_name || '' }));
    if (call.municipality_id && !municipalityOptions.some((o) => o.value === call.municipality_id)) {
        municipalityOptions.unshift({ value: call.municipality_id, label: call.municipality_name || 'Текущий округ', extra: 'Текущий округ' });
    }

    const isFire = formData.type === 'Пожар';

    const evacTotal = Number(formData.victims_evacuated_total);
    const evacChildren = Number(formData.victims_evacuated_children);
    const evacInvalid = !isNaN(evacTotal) && !isNaN(evacChildren) && evacTotal > 0 && evacChildren > evacTotal;

    return (
        <div className="space-y-4">
            {/* Шапка — фиксированная при скролле, ниже меню сайта */}
            <div className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-white/95 backdrop-blur border-b border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="ghost" onClick={() => navigate('/calls')} className="rounded-lg h-8 w-8 p-0" title="К списку вызовов">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Siren className="h-5 w-5 text-red-500" /> Вызов
                        </h1>
                        <Badge className={`${statusMeta.badge} text-white`}>{statusMeta.label}</Badge>
                        {dirty && <Badge className="bg-amber-500 text-white">есть несохранённые изменения</Badge>}
                        {call.creator_username && (
                            <span className="text-sm text-slate-500 flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                Создал: <span className="font-medium text-slate-700 max-w-[200px] block overflow-hidden text-ellipsis whitespace-nowrap">
  {call.creator_username}
</span>
                            </span>
                        )}
                        {call.call_code && (
                            <span
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700"
                                title={`Вызов №${call.number}`}
                            >
                                <span
                                    className="inline-block h-3.5 w-3.5 rounded-sm border border-slate-300"
                                    style={{ backgroundColor: call.color || '#e42525' }}
                                />
                                {call.call_code}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => setAccessOpen(true)} className="rounded-lg border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200" title="Настроить доступ к вызову">
                            <Shield className="h-4 w-4 mr-2" /> Доступ
                        </Button>
                        {canChangeStatus && transitions.map((t) => {
                            const colorCls = t.value === 'closed'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:text-white border-transparent'
                                : t.value === 'error'
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:text-white border-transparent'
                                    : '';
                            return (
                                <Button key={t.value} variant="outline" onClick={() => setStatusConfirm(t)} className={`rounded-lg ${colorCls}`}>{t.label}</Button>
                            );
                        })}
                        {canEdit && (
                            <Button onClick={handleSave} disabled={updateCall.isPending || !dirty || victimsInvalid} title={victimsInvalid ? 'Исправьте количество детей (не больше общего числа)' : undefined} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                                {updateCall.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Сохранить
                            </Button>
                        )}
                    </div>
                </div>
                {formError && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">Не удалось сохранить:</span>
                        <span className="break-words">{formError}</span>
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* ---------- Левая колонка ---------- */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Привлекаемая техника — в самом верху */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Привлекаемая техника</h2>
                        {canEdit && (
                            <SearchableSelect options={unitOptions} value="" onChange={handleAddUnit} placeholder="Добавить технику..." emptyText="Нет доступной техники" renderOption={(o) => (
                                <div className="flex flex-col min-w-0"><span className="text-sm truncate">{o.label}</span>{o.extra && <span className="text-[11px] text-slate-400 truncate">{o.extra}</span>}</div>
                            )} />
                        )}
                        {!canEdit && !attachedUnits.length && <p className="text-sm text-slate-400">Техника не привлекалась</p>}
                        {attachedUnits.map((u) => (
                            <UnitCallControl
                                key={u.unit_id}
                                unit={u}
                                statuses={allStatuses}
                                calls={availableCallsRows}
                                canEdit={canEdit}
                                currentCallId={call.id}
                                onRemove={canEdit ? () => setUnitToRemove(u.unit_id) : null}
                                onSubmitStatus={handleApplyUnitStatus}
                                onSubmitDates={handleApplyUnitDates}
                                pending={changeUnitStatus.isPending}
                                error={unitErr && unitErr.unitId === u.unit_id ? unitErr.message : null}
                            />
                        ))}
                    </div>

                    {/* Общая информация (включая описание) */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Общая информация</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="type">Тип вызова</Label>
                                <NativeSelect value={formData.type} onChange={(e) => setField('type', e.target.value)} disabled={!canEdit} className="w-full">
                                    {CALL_TYPES.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                                </NativeSelect>
                            </div>
                            <DateTimeField id="incident_at" label="Дата и время возникновения события" value={formData.incident_at} onChange={(v) => setField('incident_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('incident_at')} />
                            <DateTimeField id="message_received_at" label="Время получения сообщения" value={formData.message_received_at} onChange={(v) => setField('message_received_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('message_received_at')} />
                            <div className="space-y-2">
                                <Label>Муниципальный / городской округ</Label>
                                <SearchableSelect options={municipalityOptions} value={formData.municipality_id || ''} onChange={(v) => setField('municipality_id', v)} placeholder="Выберите округ..." emptyText="Нет доступных округов" disabled={!canEdit} renderOption={(o) => (
                                    <div className="flex flex-col min-w-0"><span className="text-sm truncate">{o.label}</span>{o.extra && <span className="text-[11px] text-slate-400 truncate">{o.extra}</span>}</div>
                                )} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="address">Адрес места происшествия</Label>
                                <AddressAutocomplete
                                    id="address"
                                    placeholder="Адрес"
                                    value={formData.address}
                                    onChange={(v) => setField('address', v)}
                                    disabled={!canEdit}
                                />
                            </div>
                            <DateTimeField id="dispatch_at" label="Время высылки сил и средств" value={formData.dispatch_at} onChange={(v) => setField('dispatch_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('dispatch_at')} />
                            <DateTimeField id="arrival_at" label="Время прибытия" value={formData.arrival_at} onChange={(v) => setField('arrival_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('arrival_at')} />
                        </div>
                        <div className="space-y-2 mt-3">
                            <Label htmlFor="description">Описание</Label>
                            <Textarea id="description" rows={4} placeholder="Описание вызова..." value={formData.description} onChange={(e) => setField('description', e.target.value)} disabled={!canEdit} className="rounded-lg" />
                        </div>
                    </div>

                    {/* Оперативно-тактическая обстановка и объекты пожара */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Оперативно-тактическая обстановка и объекты пожара</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="rank">Ранг вызова</Label>
                                    <NativeSelect value={formData.rank} onChange={(e) => setField('rank', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Не указан</NativeSelectOption>
                                        {CALL_RANKS.map((r) => <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fire_area">Площадь пожара, м²</Label>
                                    <Input id="fire_area" type="number" min="0" value={formData.fire_area === '' || formData.fire_area === null ? '' : formData.fire_area} disabled={!canEdit} onChange={(e) => setField('fire_area', e.target.value)} className="rounded-lg" />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
                                <DateTimeField id="localization_at" label="Локализация пожара" value={formData.localization_at} onChange={(v) => setField('localization_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('localization_at')} />
                                <DateTimeField id="open_fire_eliminated_at" label="Ликвидация открытого горения" value={formData.open_fire_eliminated_at} onChange={(v) => setField('open_fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('open_fire_eliminated_at')} />
                                <DateTimeField id="fire_eliminated_at" label="Ликвидация пожара" value={formData.fire_eliminated_at} onChange={(v) => setField('fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('fire_eliminated_at')} />
                            </div>
                        </div>
                    )}

                    {/* Категорирование пожара */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Категорирование пожара</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Местность</Label>
                                    <NativeSelect value={formData.area_type || 'urban'} onChange={(e) => setField('area_type', e.target.value)} disabled={!canEdit} className="w-full">
                                        {AREA_TYPES.map((a) => <NativeSelectOption key={a.value} value={a.value}>{a.label}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                <div className="space-y-2">
                                    <Label>Категория пожара</Label>
                                    <NativeSelect value={cat1 ? cat1.id : ''} onChange={(e) => handleCategoryChange(e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Не выбрано</NativeSelectOption>
                                        {(catsByParent['__ROOT__'] || []).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.code ? c.code + ' ' : ''}{c.name}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                {cat1 && cat2Options.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Подкатегория</Label>
                                        <NativeSelect value={cat2 ? cat2.id : ''} onChange={(e) => handleCategoryChange(e.target.value)} disabled={!canEdit} className="w-full">
                                            <NativeSelectOption value="">Не выбрано</NativeSelectOption>
                                            {cat2Options.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
                                        </NativeSelect>
                                    </div>
                                )}
                                {cat2 && cat3Options.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Пункт</Label>
                                        <NativeSelect value={cat3 ? cat3.id : ''} onChange={(e) => handleCategoryChange(e.target.value)} disabled={!canEdit} className="w-full">
                                            <NativeSelectOption value="">Не выбрано</NativeSelectOption>
                                            {cat3Options.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
                                        </NativeSelect>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Причина пожара */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Причина пожара</h2>
                            <div className="grid gap-3 sm:grid-cols-2 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="fire_cause">Причина</Label>
                                    <NativeSelect value={formData.fire_cause_id || ''} onChange={(e) => setField('fire_cause_id', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Не указана</NativeSelectOption>
                                        {causeOptions.map((c) => <NativeSelectOption key={c.value} value={c.value}>{c.label}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                {isOtherCause && (
                                    <div className="space-y-2">
                                        <Label htmlFor="fire_cause_other">Укажите причину</Label>
                                        <Input id="fire_cause_other" value={formData.fire_cause_other || ''} disabled={!canEdit} onChange={(e) => setField('fire_cause_other', e.target.value)} placeholder="Причина..." className="rounded-lg" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Пожар не подлежит учёту */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!formData.not_accounted_fire} disabled={!canEdit} onChange={(e) => setField('not_accounted_fire', e.target.checked)} className="h-4 w-4 accent-orange-600" />
                                <span className="text-sm font-medium text-slate-700">Пожар не подлежит учёту</span>
                            </label>
                            {formData.not_accounted_fire && (
                                <div className="space-y-2 mt-3">
                                    <Label>Причина неучёта</Label>
                                    <LongOptionsSelect
                                        value={formData.not_accounted_reason_id || ''}
                                        options={nonAccReasons.map((r) => ({ value: r.id, label: r.name }))}
                                        onChange={(v) => setField('not_accounted_reason_id', v)}
                                        disabled={!canEdit}
                                        placeholder="Выберите..."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Пострадавшие */}
                    {isFire && (
                        <div id="victims-block" className={`rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4 transition-all ${flashId === 'victims-block' ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Пострадавшие</h2>
                            <div className="space-y-4">
                                {VICTIM_GROUPS.map((g) => (
                                    <VictimsGroup
                                        key={g.dataKey}
                                        {...g}
                                        title={g.title}
                                        values={formData}
                                        data={formData[g.dataKey] || []}
                                        disabled={!canEdit}
                                        onChangeValue={setField}
                                        onChangeData={(k, arr) => setField(k, arr)}
                                    />
                                ))}
                                <div className="rounded-xl border border-slate-200 bg-white p-4" style={{ boxShadow: 'inset 0px -1px 19px 0px #cae8ff' }}>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Эвакуировано людей, чел.</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Эвакуировано</Label>
                                            <Input type="number" min="0" value={formData.victims_evacuated_total ?? ''} disabled={!canEdit} onChange={handleNumber('victims_evacuated_total')} className="rounded-lg" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">в т.ч. детей</Label>
                                            <Input type="number" min="0" value={formData.victims_evacuated_children ?? ''} disabled={!canEdit} onChange={handleNumber('victims_evacuated_children')} className={`rounded-lg ${evacInvalid ? 'border-red-400 ring-1 ring-red-300' : ''}`} />
                                        </div>
                                    </div>
                                    {evacInvalid && (
                                        <p className="text-xs text-red-600 mt-1">
                                            Количество детей не может превышать общее количество людей
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------- Правая колонка: ход событий (фиксированная) ---------- */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4 self-start lg:sticky lg:top-[8.5rem]">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700">Ход событий</h2>
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={openEventDialog} className="rounded-lg h-8">
                                <Plus className="h-4 w-4 mr-1" /> Добавить
                            </Button>
                        )}
                    </div>
                    <div className="max-h-[60vh] lg:max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                        {call.events.length === 0 && <p className="text-sm text-slate-400">Событий пока нет</p>}
                        <div className="space-y-2">
                            {call.events.map((ev) => (
                                <div key={ev.id} className={`rounded-lg border px-3 py-2 transition-colors ${flashEvents.includes(ev.id) ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-300 animate-pulse' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">{formatDateTime(ev.event_at)}</span>
                                        <span className="text-[11px] text-slate-400 truncate flex-1">· {ev.author_username || '—'}</span>
                                        {canEdit && (
                                            <Button variant="ghost" size="sm" onClick={() => setEventToDelete(ev.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700" title="Удалить событие">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap mt-1">{ev.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Диалог добавления события */}
            <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader><DialogTitle className="text-xl">Добавить ход событий</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="event_at">Дата и время</Label>
                            <Input id="event_at" type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event_text">Описание хода</Label>
                            <Textarea id="event_text" rows={4} placeholder="Например: локализация пожара, в помощь отправлена АЦ..." value={eventText} onChange={(e) => setEventText(e.target.value)} className="rounded-lg" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEventOpen(false)} className="rounded-lg">Отмена</Button>
                        <Button type="button" onClick={handleAddEvent} disabled={addEvent.isPending || !eventText.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">{addEvent.isPending ? 'Сохранение...' : 'Добавить'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог подтверждения смены статуса */}
            <AlertDialog open={!!statusConfirm} onOpenChange={(o) => { if (!o) setStatusConfirm(null); }}>
                {statusConfirm && (
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Смена статуса вызова</AlertDialogTitle>
                            <AlertDialogDescription>{statusConfirm.description}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmStatus} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">{statusConfirm.label}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>

            {/* Подтверждение удаления техники */}
            <AlertDialog open={!!unitToRemove} onOpenChange={(o) => { if (!o) setUnitToRemove(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Убрать технику</AlertDialogTitle>
                        <AlertDialogDescription>Убрать эту технику из привлекаемых к вызову?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveUnit} className="bg-red-600 hover:bg-red-700 rounded-lg">Убрать</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Подтверждение удаления события */}
            <AlertDialog open={!!eventToDelete} onOpenChange={(o) => { if (!o) setEventToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить событие</AlertDialogTitle>
                        <AlertDialogDescription>Удалить запись из хода событий? Это действие нельзя отменить.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (eventToDelete) deleteEvent.mutate({ id, eventId: eventToDelete }); setEventToDelete(null); }} className="bg-red-600 hover:bg-red-700 rounded-lg">Удалить</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Предупреждение о несохранённых данных при уходе */}
            <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) blocker.reset?.(); }}>
                <AlertDialogContent className="rounded-2xl data-[size=default]:sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
                        <AlertDialogDescription>Вы изменили параметры вызова, но не сохранили их. Сохранить изменения перед переходом?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => blocker.reset?.()} className="rounded-lg">Отмена</Button>
                        <Button variant="outline" onClick={() => blocker.proceed?.()} className="rounded-lg">Не сохранять</Button>
                        <AlertDialogAction onClick={() => { handleSave(); blocker.proceed?.(); }} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">Сохранить и перейти</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Диалог: доступ к вызову */}
            <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-orange-500" /> Доступ к вызову
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-3 space-y-3">
                        <p className="text-xs text-slate-500">
                            Выберите подразделения которые могут видеть и редактировать карточку данного вызова. Пользователи с повышенными правами, могут видеть и редактировать её в любом случае
                        </p>
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={accessSearch}
                                onChange={(e) => setAccessSearch(e.target.value)}
                                placeholder="Поиск подразделения..."
                                className="rounded-lg pl-9"
                            />
                        </div>
                        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 space-y-1">
                            {filteredDepts.length === 0 && (
                                <p className="text-sm text-slate-400 py-3">Нет доступных подразделений</p>
                            )}
                            {filteredDepts.map((d) => (
                                <label key={d.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={accessSelected.includes(d.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setAccessSelected((p) => [...p, d.id]);
                                            else setAccessSelected((p) => p.filter((x) => x !== d.id));
                                        }}
                                        className="h-4 w-4 accent-orange-600"
                                    />
                                    <span className="text-sm text-slate-700 flex-1">{d.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAccessOpen(false)} className="rounded-lg">Отмена</Button>
                        <Button
                            disabled={setCallDepts.isPending}
                            onClick={() =>
                                setCallDepts.mutate(
                                    { id, departmentIds: accessSelected },
                                    { onSuccess: () => setAccessOpen(false) }
                                )
                            }
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {setCallDepts.isPending ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CallDetail;