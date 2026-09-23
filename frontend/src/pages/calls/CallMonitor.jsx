import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useMonitorCalls } from '../../hooks/useCalls';
import {
    useUnitStatuses,
    useAvailableCalls,
    useChangeUnitStatus,
} from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    Siren,
    MapPin,
    ExternalLink,
    ChevronUp,
    ChevronDown,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { CALL_STATUS_META } from '../../lib/calls';
import UnitStatusDialog from '../../components/units/UnitStatusDialog';
import {
    isCallSoundEnabled,
    setCallSoundEnabled,
    subscribeToCallUiPrefs,
} from '../../lib/callNotificationSound';

const MONITOR_FIELDS = [
    'address', 'incident_at', 'message_received_at', 'dispatch_at', 'arrival_at',
    'description', 'fire_area', 'localization_at', 'open_fire_eliminated_at',
    'fire_eliminated_at', 'fire_category_name', 'fire_cause_name', 'fire_cause_other',
    'not_accounted_reason_name', 'type', 'rank', 'municipality_name', 'area_type',
];

const fmt = (v) => {
    if (!v) return '—';
    try {
        return format(new Date(v), 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
        return String(v);
    }
};

const Info = ({ label, value, highlight = false }) => (
    <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400">{label}</span>
        <span
            className={`text-slate-700 font-medium text-right break-words max-w-[150px] ${
                highlight ? 'bg-amber-400 animate-pulse ring-2 ring-amber-500 rounded px-1 text-black font-semibold' : ''
            }`}
        >
            {value}
        </span>
    </div>
);

// Заголовок панели вызова
const CallPanelHeader = ({ call }) => {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <button
                type="button"
                onClick={() => navigate(`/calls/${call.id}`)}
                className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-medium hover:underline"
                title="Открыть карточку вызова"
            >
                <span
                    className="inline-block h-4 w-4 rounded-sm border-2 border-slate-300"
                    style={{ backgroundColor: call.color || '#e42525' }}
                />
                <span>{call.call_code || 'Вызов'}</span>
                <ExternalLink className="h-4 w-4" />
            </button>
            <Badge variant="outline">{call.type || '—'}</Badge>
            {call.rank && <Badge variant="outline" className="text-xs">{call.rank}</Badge>}
            {call.municipality_name && (
                <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {call.municipality_name}
                </span>
            )}
        </div>
    );
};

// Информационная секция вызова
const CallInfo = ({ call, f = () => false }) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-b border-slate-100 pb-2">
        <Info label="Возникновение" value={fmt(call.incident_at)} highlight={f('incident_at')} />
        <Info label="Получено" value={fmt(call.message_received_at)} highlight={f('message_received_at')} />
        <Info label="Высылка" value={fmt(call.dispatch_at)} highlight={f('dispatch_at')} />
        <Info label="Прибытие" value={fmt(call.arrival_at)} highlight={f('arrival_at')} />
        <Info label="Адрес" value={call.address || '—'} highlight={f('address')} />
        <Info label="Округ" value={call.municipality_name || '—'} highlight={f('municipality_name')} />
    </div>
);

// Оперативно-тактическая обстановка и объекты пожара (компактно, без заголовка)
const CallOperational = ({ call, f = () => false }) => (
    <div className="rounded-lg border border-slate-200 bg-white/60 p-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Info label="Площадь пожара" value={call.fire_area == null ? '—' : `${call.fire_area} м²`} highlight={f('fire_area')} />
        <Info label="Локализация" value={fmt(call.localization_at)} highlight={f('localization_at')} />
        <Info label="Локал. откр. горения" value={fmt(call.open_fire_eliminated_at)} highlight={f('open_fire_eliminated_at')} />
        <Info label="Ликвидация пожара" value={fmt(call.fire_eliminated_at)} highlight={f('fire_eliminated_at')} />
        <Info label="Местность" value={call.area_type === 'rural' ? 'Сельская' : call.area_type === 'urban' ? 'Городская' : '—'} highlight={f('area_type')} />
    </div>
);

const CallMonitor = () => {
    const { has } = usePermissions();
    const { data, isLoading } = useMonitorCalls();
    const { data: statuses } = useUnitStatuses();
    const { data: availableCalls } = useAvailableCalls();
    const changeStatus = useChangeUnitStatus();

    const [muniFilter, setMuniFilter] = useState(null);
    const [legendOpen, setLegendOpen] = useState(true);
    const [pendingStatus, setPendingStatus] = useState(null); // { unit, callIdDefault }
    const [statusError, setStatusError] = useState('');
    const [soundOn, setSoundOn] = useState(isCallSoundEnabled());

    // Синхронизация настройки звука о новых вызовах
    useEffect(() => {
        const update = () => setSoundOn(isCallSoundEnabled());
        return subscribeToCallUiPrefs(update);
    }, []);

    const calls = useMemo(() => {
        if (!Array.isArray(data)) return [];
        if (!muniFilter) return data;
        return data.filter((c) => c.municipality_id === muniFilter);
    }, [data, muniFilter]);

    const munis = useMemo(() => {
        if (!Array.isArray(data)) return [];
        const map = new Map();
        for (const c of data) {
            if (!c.municipality_id) continue;
            const e = map.get(c.municipality_id) || { name: c.municipality_name || 'Без названия', count: 0 };
            e.count++;
            map.set(c.municipality_id, e);
        }
        return [...map.entries()]
            .map(([id, info]) => ({ id, name: info.name, count: info.count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    const canChangeStatus = has('units.update_status');
    const statusList = Array.isArray(statuses) ? statuses : [];

    const handleSoundToggle = () => setCallSoundEnabled(!soundOn);

    // Подсветка полей, изменившихся с прошлого обновления
    const [flash, setFlash] = useState(new Set());
    const prevRef = useRef(new Map());
    useEffect(() => {
        if (!Array.isArray(calls)) return;
        const next = new Map();
        const changed = new Set();
        for (const c of calls) {
            const sig = {};
            for (const f of MONITOR_FIELDS) sig[f] = String(c[f] ?? '');
            const prev = prevRef.current.get(c.id);
            if (prev) {
                for (const f of MONITOR_FIELDS) {
                    if (prev[f] !== sig[f]) changed.add(`${c.id}|${f}`);
                }
            }
            next.set(c.id, sig);
        }
        prevRef.current = next;
        if (changed.size) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFlash(new Set(changed));
            setTimeout(() => setFlash(new Set()), 3500);
        }
    }, [calls]);

    const openStatusDialog = (unit) => {
        setStatusError('');
        setPendingStatus({ unit, callIdDefault: unit.call_id || '' });
    };

    const handleStatusSubmit = (payload) => {
        if (!pendingStatus) return;
        const unit = pendingStatus.unit;
        setStatusError('');
        changeStatus.mutate(
            {
                id: unit.unit_id,
                data: {
                    status_id: payload.status_id,
                    call_id: payload.call_id,
                    add_event: payload.add_event,
                },
            },
            {
                onError: (err) =>
                    setStatusError(err?.response?.data?.error || 'Ошибка смены статуса'),
                onSuccess: () => setPendingStatus(null),
            }
        );
    };

    if (isLoading && !data) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-16">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Siren className="h-6 w-6 text-red-500" />
                        Мониторинг вызовов
                    </h1>
                    <p className="text-sm text-slate-400">Вызовы в обработке: {calls.length}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSoundToggle}
                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                            soundOn
                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title={soundOn ? 'Отключить звук о новых вызовах' : 'Включить звук о новых вызовах'}
                    >
                        {soundOn ? (
                            <Volume2 className="h-4 w-4" />
                        ) : (
                            <VolumeX className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>
{/* Список вызовов */}
            {calls.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <p>Нет вызовов в обработке{muniFilter ? ' по выбранному округу' : ''}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {calls.map((call) => {
                        const units = Array.isArray(call.units) ? call.units : [];
                        const events = Array.isArray(call.events) ? call.events : [];
                        const sm = CALL_STATUS_META[call.status] || { label: call.status, badge: 'bg-slate-500 dark:bg-slate-500/40' };
                        const rowBg = call.status === 'error' ? 'bg-red-50' : call.status === 'closed' ? 'bg-green-50' : 'bg-orange-50/40';
                        const f = (field) => flash.has(`${call.id}|${field}`);
                        return (
                            <div key={call.id} className={`rounded-xl border border-slate-200 overflow-hidden ${rowBg} dark:bg-[#1717179e]`} style={{ boxShadow: '4px 11px 20px #00000030' }}>
                                <div className="px-4 py-2 flex flex-wrap items-center gap-2">
                                    <CallPanelHeader call={call} />
                                    <Badge className={`${sm.badge} text-white`}>{sm.label}</Badge>
                                </div>
                                <div className="grid grid-cols-[1fr_280px] gap-3 px-4 py-3">
                                    <div className="min-w-0 space-y-3">
                                        <CallInfo call={call} f={f} />
                                        {call.description && (
                                            <div className={`rounded-lg border border-slate-200 bg-white/60 p-2 ${
                                                f('description') ? 'ring-2 ring-amber-400 animate-pulse' : ''
                                            }`}>
                                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                                    Описание
                                                </div>
                                                <div className="text-xs text-slate-700 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                                                    {call.description}
                                                </div>
                                            </div>
                                        )}
                                        <CallOperational call={call} f={f} />
                                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Привлекаемая техника</div>
                                        {units.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic">Техника не привлечена</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {units.map((unit) => (
                                                    <div key={unit.unit_id} className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-slate-800 truncate">{unit.unit_name}</span>
                                                        {unit.department_name && (
                                                            <span className="text-xs text-slate-400 truncate">{unit.department_name}</span>
                                                        )}
                                                        {(unit.dispatch_at || unit.arrival_at) && (
                                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                                {unit.dispatch_at ? `Выезд ${fmt(unit.dispatch_at)}` : ''}
                                                                {unit.dispatch_at && unit.arrival_at ? ' · ' : ''}
                                                                {unit.arrival_at ? `Приб. ${fmt(unit.arrival_at)}` : ''}
                                                            </span>
                                                        )}
                                                        {canChangeStatus ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openStatusDialog(unit)}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white transition-all hover:scale-105 hover:brightness-110 cursor-pointer"
                                                                style={{ backgroundColor: unit.unit_status_color || '#94a3b8' }}
                                                                title="Нажмите, чтобы изменить статус"
                                                            >
                                                                <span>{unit.unit_status_name || 'Без статуса'}</span>
                                                            </button>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs" style={{ backgroundColor: unit.unit_status_color || '#94a3b8' }}>
                                                                {unit.unit_status_name || '—'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border border-slate-200 rounded-lg bg-white/70 flex flex-col max-h-64">
                                        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 sticky top-0 bg-slate-50 border-b border-slate-100">
                                            Ход событий
                                        </div>
                                        {events.length === 0 ? (
                                            <div className="text-xs text-slate-400 py-4 text-center">Нет событий</div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 overflow-y-auto">
                                                {events.map((e) => (
                                                    <div key={e.id} className="px-2 py-1.5 text-xs">
                                                        <div className="text-slate-400 font-mono text-[10px]">{fmt(e.event_at)}</div>
                                                        <div className="text-slate-700 break-words">{e.text}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
{/* Фиксированная легенда округов внизу (свёртываемая) */}
            {munis.length >= 1 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 rounded-t-xl shadow-md px-4 py-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Округа:
                    </span>
                    {legendOpen ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setMuniFilter(null)}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                    !muniFilter ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                Все
                            </button>
                            {munis.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMuniFilter(muniFilter === m.id ? null : m.id)}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                        muniFilter === m.id ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {m.name}
                                    <span className={`inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] ${
                                        muniFilter === m.id
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {m.count}
                                    </span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setLegendOpen(false)}
                                className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
                                title="Свернуть легенду"
                            >
                                Свернуть <ChevronDown className="h-3 w-3" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setLegendOpen(true)}
                            className="ml-auto inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            Показать округа
                            <ChevronUp className="h-3 w-3" />
                        </button>
                    )}
                </div>
            )}

            <UnitStatusDialog
                open={!!pendingStatus}
                onOpenChange={(open) => {
                    if (!open) setPendingStatus(null);
                }}
                unitName={pendingStatus?.unit.unit_name || ''}
                statuses={statusList}
                calls={Array.isArray(availableCalls) ? availableCalls : []}
                currentStatusId={pendingStatus?.unit.status_id}
                defaultCallId={pendingStatus?.unit.call_id || ''}
                onSubmit={handleStatusSubmit}
                pending={changeStatus.isPending}
                error={statusError || undefined}
            />
        </div>
    );
};

export default CallMonitor;