import { useMemo, useRef } from 'react';
import { Loader2, X, Truck, Clock, Palette, MoreVertical } from 'lucide-react';
import {
    useUnitHistory,
    useUnitStatuses,
    useChangeUnitStatus,
} from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const UnitDetailsPanel = ({ unit, onClose }) => {
    const { has } = usePermissions();
    const { data: statuses } = useUnitStatuses();
    const changeStatus = useChangeUnitStatus();

    const {
        data: historyData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useUnitHistory(unit?.id);

    // Разворачиваем все страницы в плоский массив
    const history = useMemo(() => {
        if (!historyData?.pages) return [];
        return historyData.pages.flatMap((page) => page.rows || []);
    }, [historyData]);

    const scrollRef = useRef(null);

    // Подгрузка при скролле вниз
    const handleScroll = (e) => {
        const el = e.currentTarget;
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 200 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
    };

    if (!unit) return null;

    const canChangeStatus = has('units.update_status');

    const handleStatusChange = (statusId) => {
        if (statusId === unit.status_id) return;
        changeStatus.mutate(
            { id: unit.id, data: { status_id: statusId } },
            {
                onError: (err) =>
                    alert(err.response?.data?.error || 'Ошибка смены статуса'),
            }
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Шапка */}
            <div className="p-4 border-b border-slate-200 flex items-start gap-3 flex-shrink-0">
                <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: unit.status_color || '#94a3b8' }}
                >
                    <Truck className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                        {unit.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                        {unit.plate_number || 'без номера'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0"
                    title="Закрыть"
                >
                    <X className="h-4 w-4 text-slate-500" />
                </button>
            </div>

            {/* Информация */}
            <div className="p-4 space-y-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-500 flex-shrink-0">Статус</span>
                    <div className="flex flex-col items-end gap-1.5">
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white"
                style={{ backgroundColor: unit.status_color }}
            >
              {changeStatus.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
              )}
                <span>{unit.status_name}</span>
            </span>

                        {canChangeStatus && (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger
                                    asChild
                                    disabled={changeStatus.isPending}
                                >
                                    <button
                                        type="button"
                                        disabled={changeStatus.isPending}
                                        className="inline-flex items-center gap-1 text-[10px] text-orange-600 hover:text-orange-700 font-medium"
                                        title="Сменить статус"
                                    >
                                        <Palette className="h-3 w-3" />
                                        сменить
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    sideOffset={4}
                                    collisionPadding={16}
                                    className="min-w-[220px]"
                                >
                                    <DropdownMenuLabel>Сменить статус</DropdownMenuLabel>
                                    {(statuses || []).map((s) => {
                                        const isCurrent = s.id === unit.status_id;
                                        return (
                                            <DropdownMenuItem
                                                key={s.id}
                                                disabled={isCurrent}
                                                onClick={() => !isCurrent && handleStatusChange(s.id)}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                          <span
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                          />
                                                    <span className="flex-1">{s.name}</span>
                                                    {isCurrent && (
                                                        <span className="text-[10px] text-slate-400">
                              текущий
                            </span>
                                                    )}
                                                </div>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {unit.status_changed_at && (
                    <InfoRow
                        label="Изменён"
                        value={format(
                            new Date(unit.status_changed_at),
                            'dd.MM.yyyy HH:mm',
                            { locale: ru }
                        )}
                    />
                )}
                <InfoRow label="Тип" value={unit.type_name || '—'} />
                <InfoRow label="Подразделение" value={unit.department_name || '—'} />
                <InfoRow
                    label="Отделение"
                    value={unit.squad_number ? `№${unit.squad_number}` : '—'}
                />
                {unit.show_in_grid === false && (
                    <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                        Скрыта из сетки
                    </div>
                )}
            </div>

            {/* История — здесь скролл и бесконечная подгрузка */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                        <Clock className="h-3 w-3" />
                        История статусов
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-8 px-4">
                        История пуста
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-100">
                            {history.map((h) => (
                                <div key={h.id} className="px-4 py-3">
                                    <div className="flex items-center gap-2 mb-1">
                    <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: h.status_color }}
                    />
                                        <span className="text-sm font-medium text-slate-800 truncate">
                      {h.status_name}
                    </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {format(new Date(h.changed_at), 'dd.MM.yyyy HH:mm:ss', {
                          locale: ru,
                      })}
                    </span>
                                        {h.changed_by_display_name || h.changed_by_username ? (
                                            <span className="truncate ml-2">
                        {h.changed_by_display_name || h.changed_by_username}
                      </span>
                                        ) : null}
                                    </div>
                                    {h.comment && (
                                        <div className="text-xs text-slate-500 mt-1 italic">
                                            «{h.comment}»
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Индикатор подгрузки внизу */}
                        {isFetchingNextPage && (
                            <div className="flex justify-center py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            </div>
                        )}

                        {!hasNextPage && history.length > 0 && (
                            <div className="text-center text-[10px] text-slate-300 py-3">
                                — конец истории —
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex items-start justify-between gap-3 text-sm">
        <span className="text-slate-500 flex-shrink-0">{label}</span>
        <span className="text-slate-800 text-right">{value}</span>
    </div>
);

export default UnitDetailsPanel;