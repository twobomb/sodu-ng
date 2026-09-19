import { useState, useMemo, useEffect } from 'react';
import {
    Loader2,
    RefreshCw,
    LayoutList,
    LayoutGrid,
    Maximize2,
    Zap,
    Volume2,
    VolumeX,
    ChevronRight,
    Search,
    Filter,
    Download,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    buildCsv,
    downloadCsv,
    timestampForFilename,
} from '../../lib/csvExport';
import { useUnitsGrid, useUnitStatuses, useUnit } from '../../hooks/useUnits';
import UnitCell from '../../components/units/UnitCell';
import UnitDetailsPanel from '../../components/units/UnitDetailsPanel';
import GlobalHistoryLog from '../../components/units/GlobalHistoryLog';
import {
    isUnitSoundEnabled,
    setUnitSoundEnabled,
    subscribeToUnitUiPrefs,
} from '../../lib/unitNotificationSound';

const UnitsGrid = () => {
    // ============================================================
    // Состояния
    // ============================================================
    const [sort, setSort] = useState(() => localStorage.getItem('unitsGridSort') || 'default');
    const [viewMode, setViewMode] = useState(
        () => localStorage.getItem('unitsGridViewMode') || 'compact'
    );
    const [selectedUnitId, setSelectedUnitId] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [soundOn, setSoundOn] = useState(isUnitSoundEnabled());

    // ============================================================
    // Данные
    // ============================================================
    const { data: grid, isLoading, refetch, isFetching } = useUnitsGrid(sort);
    const { data: statuses } = useUnitStatuses();

    // Ищем юнит в свежем кеше grid — покрывает 95% кликов
    const selectedUnitFromGrid = useMemo(() => {
        if (!selectedUnitId || !grid) return null;
        for (const dept of grid) {
            const u = dept.units.find((x) => x.id === selectedUnitId);
            if (u) return { ...u, department_name: dept.department_name };
        }
        return null;
    }, [selectedUnitId, grid]);

    // Fallback: юнит не в grid (например, show_in_grid=false) — грузим с сервера
    const { data: selectedUnitFromApi } = useUnit(selectedUnitId, {
        enabled: !!selectedUnitId && !selectedUnitFromGrid,
    });

    const selectedUnit = selectedUnitFromGrid || selectedUnitFromApi || null;

    // Запоминаем выбранный режим отображения и сортировку
    useEffect(() => {
        localStorage.setItem('unitsGridViewMode', viewMode);
    }, [viewMode]);
    useEffect(() => {
        localStorage.setItem('unitsGridSort', sort);
    }, [sort]);

    // Синхронизация настройки звука
    useEffect(() => {
        const update = () => setSoundOn(isUnitSoundEnabled());
        return subscribeToUnitUiPrefs(update);
    }, []);

    // ============================================================
    // Фильтрация
    // ============================================================
    const filteredGrid = useMemo(() => {
        if (!grid) return [];
        let result = grid;

        // Фильтр по статусу
        if (statusFilter) {
            result = result
                .map((dept) => ({
                    ...dept,
                    units: dept.units.filter((u) => u.status_id === statusFilter),
                }))
                .filter((dept) => dept.units.length > 0);
        }

        // Поиск
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result
                .map((dept) => {
                    const deptMatches = dept.department_name.toLowerCase().includes(q);
                    const units = deptMatches
                        ? dept.units
                        : dept.units.filter(
                            (u) =>
                                u.name.toLowerCase().includes(q) ||
                                u.plate_number?.toLowerCase().includes(q) ||
                                u.type_short_name?.toLowerCase().includes(q)
                        );
                    return { ...dept, units };
                })
                .filter(
                    (dept) =>
                        dept.units.length > 0 ||
                        dept.department_name.toLowerCase().includes(q)
                );
        }

        return result;
    }, [grid, search, statusFilter]);

    // ============================================================
    // Счётчики
    // ============================================================
    const stats = useMemo(() => {
        if (!grid) return { depts: 0, units: 0, active: 0 };
        let depts = 0;
        let units = 0;
        let active = 0;
        for (const d of grid) {
            depts++;
            units += d.units.length;
            if (d.has_active_call) active++;
        }
        return { depts, units, active };
    }, [grid]);

    const statusCounts = useMemo(() => {
        if (!grid) return {};
        const counts = {};
        for (const dept of grid) {
            for (const u of dept.units) {
                counts[u.status_id] = (counts[u.status_id] || 0) + 1;
            }
        }
        return counts;
    }, [grid]);

    // ============================================================
    // Обработчики
    // ============================================================
    const handleSoundToggle = () => {
        setUnitSoundEnabled(!soundOn);
    };

    const handleExport = () => {
        const rows = [];
        for (const dept of filteredGrid) {
            for (const u of dept.units) {
                rows.push({
                    department: dept.department_name,
                    name: u.name,
                    type: u.type_short_name || '',
                    plate: u.plate_number || '',
                    squad: u.squad_number ? `№${u.squad_number}` : '',
                    status: u.status_name,
                    status_short: u.status_short_name,
                    status_changed: u.status_changed_at
                        ? new Date(u.status_changed_at).toLocaleString('ru-RU')
                        : '',
                });
            }
        }

        const columns = [
            { key: 'department', label: 'Подразделение' },
            { key: 'name', label: 'Название' },
            { key: 'type', label: 'Тип' },
            { key: 'plate', label: 'Госномер' },
            { key: 'squad', label: 'Отделение' },
            { key: 'status', label: 'Статус (полный)' },
            { key: 'status_short', label: 'Статус (кратко)' },
            { key: 'status_changed', label: 'Изменён' },
        ];

        const csv = buildCsv(rows, columns);
        downloadCsv(`units-grid_${timestampForFilename()}.csv`, csv);
    };

    const legend = statuses || [];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-65px)] -mx-8 -my-6">
            {/* Верхняя панель */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center gap-3 flex-shrink-0">
                <div className="flex-1 min-w-[200px]">
                    <h1 className="text-1xl font-bold text-slate-800">Мониторинг техники</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {stats.depts} подразделений<br/> {stats.units} ед. техники<br/>
                        {stats.active > 0 && (
                            <>
                                <span className="text-orange-600 font-medium">
                  {stats.active} с активным выездом
                </span>
                            </>
                        )}
                    </p>
                </div>

                {/* Поиск */}
                <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 rounded-lg text-sm"
                    />
                </div>

                {/* Фильтр по статусу */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-9 rounded-lg gap-1.5 ${
                                statusFilter
                                    ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                    : ''
                            }`}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            {statusFilter
                                ? (statuses || []).find((s) => s.id === statusFilter)
                                ?.short_name || 'Статус'
                                : 'Все статусы'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[240px]">
                        <DropdownMenuLabel>Фильтр по статусу</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                            <div className="flex items-center gap-2 w-full">
                                <span className="h-3 w-3 rounded-full bg-slate-300 flex-shrink-0" />
                                <span className="flex-1">Все статусы</span>
                                <span className="text-[10px] text-slate-400">
                  {stats.units}
                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(statuses || []).map((s) => {
                            const count = statusCounts[s.id] || 0;
                            const isCurrent = statusFilter === s.id;
                            return (
                                <DropdownMenuItem
                                    key={s.id}
                                    disabled={count === 0}
                                    onClick={() => setStatusFilter(s.id)}
                                >
                                    <div className="flex items-center gap-2 w-full">
                    <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                    />
                                        <span className="flex-1">{s.name}</span>
                                        <span className="text-[10px] text-slate-400">
                      {count}
                    </span>
                                        {isCurrent && (
                                            <span className="text-[10px] text-orange-500 font-medium">
                        ●
                      </span>
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Режим отображения ячеек */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5" title="Режим отображения ячеек">
                    <button
                        type="button"
                        onClick={() => setViewMode('compact')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            viewMode === 'compact'
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Компактный
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('big')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            viewMode === 'big'
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Большой
                    </button>
                </div>

                {/* Переключатель сортировки */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setSort('default')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            sort === 'default'
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Сортировка по дереву подразделений"
                    >
                        <LayoutList className="h-3.5 w-3.5" />
                        По подразделениям
                    </button>
                    <button
                        type="button"
                        onClick={() => setSort('dynamic')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            sort === 'dynamic'
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Сначала — подразделения с активными выездами"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Динамическая
                    </button>
                </div>

                {/* Звук */}
                <button
                    type="button"
                    onClick={handleSoundToggle}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                        soundOn
                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                    title={soundOn ? 'Отключить звук' : 'Включить звук'}
                >
                    {soundOn ? (
                        <Volume2 className="h-4 w-4" />
                    ) : (
                        <VolumeX className="h-4 w-4" />
                    )}
                </button>

                {/* Экспорт CSV */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={filteredGrid.length === 0}
                    className="h-9 rounded-lg gap-1.5"
                    title="Экспорт в CSV"
                >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                </Button>

                {/* Обновить */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="h-9 rounded-lg"
                    title="Обновить"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                    />
                </Button>
            </div>

            {/* Основная область */}
            <div className="flex-1 flex min-h-0">
                {/* Сетка */}
                <div className="flex-1 overflow-y-auto px-8 py-4">
                    {filteredGrid.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-16">
                            Нет техники
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGrid.map((dept) => (
                                <div
                                    key={dept.department_id}
                                    className={`flex items-stretch gap-3 rounded-lg transition-colors ${
                                        dept.has_active_call
                                            ? 'bg-orange-50/50 dark:bg-[#291d02] border border-orange-200 dark:border-orange-500/30'
                                            : 'bg-white border border-slate-200'
                                    }`}
                                >
                                    {/* Название подразделения */}
                                    <div
                                        className="flex items-center gap-2 flex-shrink-0 py-2 px-3"
                                        style={{ marginLeft: dept.level * 16 }}
                                    >
                                        {dept.level > 0 && (
                                            <ChevronRight className="h-3 w-3 text-slate-300 flex-shrink-0" />
                                        )}
                                        <div className="min-w-[180px]">
                                            <div className="text-sm font-medium text-slate-800 truncate">
                                                {dept.department_name}
                                            </div>
                                            {dept.has_active_call && (
                                                <div className="text-[10px] text-orange-600 dark:text-orange-300 font-medium">
                                                    есть выезд
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Разделитель */}
                                    <div className="w-px bg-slate-200" />

                                    {/* Ячейки техники */}
                                    <div className="flex-1 flex flex-wrap gap-2 py-2 px-3">
                                        {dept.units.length === 0 ? (
                                            <div className="text-xs text-slate-300 self-center italic">
                                                нет техники
                                            </div>
                                        ) : (
                                            dept.units.map((unit) => (
                                                <UnitCell
                                                    key={unit.id}
                                                    unit={unit}
                                                    big={viewMode === 'big'}
                                                    onClick={(u) => setSelectedUnitId(u.id)}
                                                    isSelected={selectedUnitId === unit.id}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Правая панель */}
                <div className="w-[380px] bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
                    {selectedUnitId ? (
                        <UnitDetailsPanel
                            unit={selectedUnit}
                            onClose={() => setSelectedUnitId(null)}
                        />
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-slate-800">
                                        Хронология изменений
                                    </h2>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Последние 50 изменений статусов
                                </p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <GlobalHistoryLog
                                    onSelectUnit={(id) => setSelectedUnitId(id)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Легенда */}
            {legend.length > 0 && (
                <div className="bg-white border-t border-slate-200 px-8 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Легенда:
          </span>
                    {legend.map((s) => {
                        const count = statusCounts[s.id] || 0;
                        const isActive = statusFilter === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStatusFilter(isActive ? null : s.id)}
                                disabled={count === 0}
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors ${
                                    count === 0
                                        ? 'opacity-40 cursor-not-allowed'
                                        : isActive
                                            ? 'bg-orange-50 ring-1 ring-orange-300 cursor-pointer'
                                            : 'hover:bg-slate-100 cursor-pointer'
                                }`}
                                title={
                                    count > 0
                                        ? isActive
                                            ? 'Снять фильтр'
                                            : `Показать только "${s.name}"`
                                        : 'Нет техники в этом статусе'
                                }
                            >
                <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: s.color }}
                />
                                <span className="text-[11px] text-slate-600">
                  {s.short_name}
                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                  {count}
                </span>
                            </button>
                        );
                    })}
                    {statusFilter && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter(null)}
                            className="ml-auto text-[11px] text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                            <X className="h-3 w-3" />
                            Сбросить фильтр
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default UnitsGrid;