import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCalls, useCreateCall, useMunicipalities } from '../../hooks/useCalls';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import { decodeSampleDefinition } from '../../lib/callSampleUrl';
import {
    CALL_TYPES,
    CALL_STATUS_META,
    formatDateTime,
} from '../../lib/calls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import DateRangeFilter from '../../components/calls/DateRangeFilter';
import CallsColumnsDialog from '../../components/calls/CallsColumnsDialog';
import { normalizeColumnsState, visibleColumnsOf } from '../../lib/callColumns';
import {
    ChevronDown,
    Columns3,
    FilterX,
    ListFilter,
    Loader2,
    Plus,
    Search,
    Siren,
    SlidersHorizontal,
} from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

// Задержка перед отправкой поискового запроса после последнего нажатия клавиши
const SEARCH_DEBOUNCE_MS = 350;

// Значения фильтров по умолчанию
const EMPTY_FILTERS = {
    search: '',
    municipality: 'all',
    type: 'all',
    status: 'all',
    createdFrom: '',
    createdTo: '',
    receivedFrom: '',
    receivedTo: '',
    carryover: 'all',
    falseCall: 'all',
};

// «Расширенные» фильтры — если задан любой из них, панель раскрывается
const ADVANCED_KEYS = [
    'status',
    'createdFrom',
    'createdTo',
    'receivedFrom',
    'receivedTo',
    'carryover',
    'falseCall',
];

const hasAdvancedFilters = (f) => ADVANCED_KEYS.some((k) => f[k] !== EMPTY_FILTERS[k]);

// Сколько фильтров реально задано (для заметной индикации)
const countActiveFilters = (f) =>
    Object.keys(EMPTY_FILTERS).filter((k) => f[k] !== EMPTY_FILTERS[k]).length;

// Чтение пользовательских настроек из localStorage
const readStored = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { ...fallback };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...fallback };
        return { ...fallback, ...parsed };
    } catch {
        return { ...fallback };
    }
};

// Отображаемые поля: порядок колонок и скрытые (сохраняются для пользователя)
const readColumnsState = (key) => {
    try {
        const raw = localStorage.getItem(key);
        return normalizeColumnsState(raw ? JSON.parse(raw) : null);
    } catch {
        return normalizeColumnsState(null);
    }
};

// Список страниц для пагинации с многоточиями, напр. [1, '…', 4, 5, 6, '…', 20]
const getPageItems = (current, total) => {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) items.push('…');
    for (let p = start; p <= end; p++) items.push(p);
    if (end < total - 1) items.push('…');
    items.push(total);
    return items;
};


const CallsList = () => {
    const navigate = useNavigate();
    const { has } = usePermissions();
    const { user } = useAuth();
    const createCall = useCreateCall();

    // Персональные настройки храним отдельно для каждого пользователя
    const storageSuffix = user?.id || 'anonymous';
    const filtersKey = `callsFilters:${storageSuffix}`;
    const columnsKey = `callsColumns:${storageSuffix}`;

    // Фильтр по выборке (из конструктора «Отчёты → Выборка вызовов»):
    //  - sample_id (+ sample_name) — сохранённая выборка;
    //  - cq — определение запроса, закодированное в base64url.
    const [searchParams, setSearchParams] = useSearchParams();
    const sampleId = searchParams.get('sample_id');
    const sampleNameParam = searchParams.get('sample_name');
    const cq = searchParams.get('cq');
    const sampleJson = useMemo(() => decodeSampleDefinition(cq), [cq]);
    const activeSample = !!(sampleId || sampleJson);
    const sampleLabel = sampleId
        ? (sampleNameParam || 'Сохранённая выборка')
        : 'Выборка вызовов';

    // Пагинация
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        const saved = Number(localStorage.getItem('callsPageSize'));
        return PAGE_SIZES.includes(saved) ? saved : 25;
    });

    useEffect(() => {
        localStorage.setItem('callsPageSize', String(pageSize));
    }, [pageSize]);

    // ---- Фильтры (сохраняются для пользователя) ----
    // Восстанавливаем сохранённые значения один раз и используем для нескольких состояний
    const [initialFilters] = useState(() => readStored(filtersKey, EMPTY_FILTERS));
    const [filters, setFilters] = useState(initialFilters);
    // Текст поиска вводится мгновенно, а в запрос уходит с задержкой (debounce)
    const [searchInput, setSearchInput] = useState(initialFilters.search);
    // Если сохранены расширенные фильтры — панель сразу раскрыта
    const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedFilters(initialFilters));

    useEffect(() => {
        localStorage.setItem(filtersKey, JSON.stringify(filters));
    }, [filters, filtersKey]);

    // Debounce поиска: пока пользователь печатает, запрос не уходит
    useEffect(() => {
        if (searchInput === filters.search) return undefined;
        const timer = setTimeout(() => {
            setFilters((prev) => ({ ...prev, search: searchInput }));
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput, filters.search]);

    // ---- Отображаемые поля (порядок и видимость сохраняются для пользователя) ----
    const [columns, setColumns] = useState(() => readColumnsState(columnsKey));
    const [columnsOpen, setColumnsOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem(columnsKey, JSON.stringify(columns));
    }, [columns, columnsKey]);

    const setFilter = (patch) => {
        setFilters((prev) => ({ ...prev, ...patch }));
        setPage(1);
    };

    const activeCount = countActiveFilters(filters);

    const munisQuery = useMunicipalities();

    const { data, isLoading, isFetching, error } = useCalls({
        search: filters.search || undefined,
        status: filters.status,
        type: filters.type,
        municipality: filters.municipality,
        created_from: filters.createdFrom || undefined,
        created_to: filters.createdTo || undefined,
        received_from: filters.receivedFrom || undefined,
        received_to: filters.receivedTo || undefined,
        carryover_fire: filters.carryover === 'all' ? undefined : filters.carryover,
        false_call: filters.falseCall === 'all' ? undefined : filters.falseCall,
        page,
        pageSize,
        sample_id: sampleId || undefined,
        sample: !sampleId && sampleJson ? sampleJson : undefined,
    });

    const calls = data?.items || [];
    const total = data?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const munisList = Array.isArray(munisQuery.data)
        ? munisQuery.data
        : (munisQuery.data?.data || []);
    const municipalityOptions = [
        { value: 'all', label: 'Все округа' },
        ...munisList.map((m) => ({ value: m.id, label: m.name })),
    ];

    // Видимые колонки в порядке, заданном пользователем
    const orderedColumns = useMemo(() => visibleColumnsOf(columns), [columns]);

    const handleCreate = () => {
        if (createCall.isPending) return;
        createCall.mutate(undefined, {
            onSuccess: (created) => {
                const id = created?.data?.id || created?.id;
                if (id) navigate(`/calls/${id}`);
            },
        });
    };

    const changePageSize = (val) => {
        setPageSize(Number(val));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters({ ...EMPTY_FILTERS });
        setSearchInput('');
        setPage(1);
    };

    // Убрать фильтр по выборке из адресной строки
    const clearSample = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('sample_id');
        next.delete('sample_name');
        next.delete('cq');
        setSearchParams(next, { replace: true });
        setPage(1);
    };

    // Классы ячеек для отдельных колонок
    const cellClass = (key) => {
        if (['call_code', 'incident_at', 'message_received_at', 'created_at'].includes(key)) {
            return 'whitespace-nowrap';
        }
        if (key === 'description') return 'max-w-[320px]';
        return '';
    };

    // Ячейка таблицы по ключу колонки
    const renderCell = (call, key) => {
        switch (key) {
            case 'call_code':
                return (
                    <span className="inline-flex items-center gap-2">
                        <span
                            className="inline-block h-4 w-4 rounded-sm border border-slate-300"
                            style={{ backgroundColor: call.color || '#e42525' }}
                            title={call.color || ''}
                        />
                        {call.call_code || '—'}
                    </span>
                );
            case 'incident_at':
                return formatDateTime(call.incident_at);
            case 'message_received_at':
                return formatDateTime(call.message_received_at);
            case 'created_at':
                return formatDateTime(call.created_at);
            case 'address':
                return call.address || '—';
            case 'description':
                return call.description ? (
                    <span className="block truncate" title={call.description}>
                        {call.description}
                    </span>
                ) : '—';
            case 'municipality_name':
                return call.municipality_name || '—';
            case 'type':
                return call.type || '—';
            case 'units_count':
                return call.units_count || 0;
            case 'carryover_fire':
                return call.carryover_fire ? (
                    <Badge className="bg-amber-500 text-white">переходящий</Badge>
                ) : (
                    <span className="text-slate-300">—</span>
                );
            case 'false_call':
                return call.false_call ? (
                    <Badge className="bg-rose-600 text-white">ЛОЖНЫЙ</Badge>
                ) : (
                    <span className="text-slate-300">—</span>
                );
            case 'status': {
                const meta = CALL_STATUS_META[call.status] || {
                    label: call.status,
                    badge: 'bg-slate-500 dark:bg-slate-500/40',
                };
                return <Badge className={`${meta.badge} text-white`}>{meta.label}</Badge>;
            }
            default:
                return '—';
        }
    };

    return (
        <div className="space-y-4">
            {/* Заголовок */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Siren className="h-6 w-6 text-red-500" />
                        Вызовы
                    </h1>
                    <p className="text-sm text-slate-400">
                        Карточки вызовов, доступные для совместного редактирования
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setColumnsOpen(true)}
                        className="rounded-lg"
                        title="Настроить отображаемые поля"
                    >
                        <Columns3 className="h-4 w-4 mr-2" />
                        Отображаемые поля
                    </Button>
                    {has('calls.create') && (
                        <Button
                            onClick={handleCreate}
                            disabled={createCall.isPending}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {createCall.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Новый вызов
                        </Button>
                    )}
                </div>
            </div>

            {/* Фильтр по выборке из конструктора */}
            {activeSample && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-orange-800">
                        <ListFilter className="h-4 w-4" />
                        Активен фильтр по выборке:
                        <span className="font-semibold">{sampleLabel}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearSample} className="rounded-lg">
                        <FilterX className="h-4 w-4 mr-1" />Убрать фильтр
                    </Button>
                </div>
            )}

            {/* Заметный индикатор: список показан с фильтрами */}
            {activeCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-100 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-orange-900">
                        <ListFilter className="h-4 w-4" />
                        Список показан с фильтрами
                        <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
                            {activeCount}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={resetFilters}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                    >
                        <FilterX className="h-4 w-4 mr-1" /> Сбросить фильтры
                    </Button>
                </div>
            )}


            {/* Фильтры */}
            <div
                className={`rounded-xl border bg-white shadow-sm p-3 space-y-3 ${
                    activeCount > 0 ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200'
                }`}
            >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <ListFilter className="h-4 w-4 text-slate-400" />
                    Фильтры
                </div>

                {/* Базовые фильтры */}
                <div className="grid gap-2 sm:grid-cols-3 items-end">
                    <div className="space-y-2">
                        <Label>Поиск</Label>
                        <div className="relative">
                            <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <Input
                                placeholder="Адрес, округ, описание..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="rounded-lg pl-8"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Округ</Label>
                        <SearchableSelect
                            options={municipalityOptions}
                            value={filters.municipality}
                            onChange={(v) => setFilter({ municipality: v })}
                            placeholder="Выберите округ..."
                            emptyText="Округов не найдено"
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Тип вызова</Label>
                        <NativeSelect
                            value={filters.type}
                            onChange={(e) => setFilter({ type: e.target.value })}
                            className="w-full"
                        >
                            <NativeSelectOption value="all">Все типы</NativeSelectOption>
                            {CALL_TYPES.map((t) => (
                                <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                </div>


                {/* Расширенные фильтры */}
                {advancedOpen && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 items-end border-t border-slate-100 pt-3">
                        <div className="space-y-2">
                            <Label>Статус</Label>
                            <NativeSelect
                                value={filters.status}
                                onChange={(e) => setFilter({ status: e.target.value })}
                                className="w-full"
                            >
                                <NativeSelectOption value="all">Все статусы</NativeSelectOption>
                                {Object.entries(CALL_STATUS_META).map(([value, meta]) => (
                                    <NativeSelectOption key={value} value={value}>
                                        {meta.label}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>

                        <DateRangeFilter
                            label="Создан"
                            value={{ from: filters.createdFrom, to: filters.createdTo }}
                            onChange={({ from, to }) => setFilter({ createdFrom: from, createdTo: to })}
                        />

                        <DateRangeFilter
                            label="Время получения сообщения"
                            value={{ from: filters.receivedFrom, to: filters.receivedTo }}
                            onChange={({ from, to }) => setFilter({ receivedFrom: from, receivedTo: to })}
                        />

                        <div className="space-y-2">
                            <Label>Переходящий пожар</Label>
                            <NativeSelect
                                value={filters.carryover}
                                onChange={(e) => setFilter({ carryover: e.target.value })}
                                className="w-full"
                            >
                                <NativeSelectOption value="all">Все</NativeSelectOption>
                                <NativeSelectOption value="true">Только переходящие</NativeSelectOption>
                                <NativeSelectOption value="false">Без переходящих</NativeSelectOption>
                            </NativeSelect>
                        </div>

                        <div className="space-y-2">
                            <Label>Ложный вызов</Label>
                            <NativeSelect
                                value={filters.falseCall}
                                onChange={(e) => setFilter({ falseCall: e.target.value })}
                                className="w-full"
                            >
                                <NativeSelectOption value="all">Все</NativeSelectOption>
                                <NativeSelectOption value="true">Только ложные</NativeSelectOption>
                                <NativeSelectOption value="false">Без ложных</NativeSelectOption>
                            </NativeSelect>
                        </div>
                    </div>
                )}

                {/* Нижняя панель: сброс и «Расширенный» */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        {isFetching && !isLoading && (
                            <span className="inline-flex items-center gap-1 text-orange-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Обновление…
                            </span>
                        )}
                        {activeCount > 0 ? `Задано фильтров: ${activeCount}` : 'Фильтры не заданы'}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            disabled={activeCount === 0}
                            className={`rounded-lg ${
                                activeCount > 0
                                    ? 'border-orange-400 text-orange-700 hover:bg-orange-50'
                                    : ''
                            }`}
                        >
                            <FilterX className="h-4 w-4 mr-1" /> Сбросить
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdvancedOpen((v) => !v)}
                            className="rounded-lg"
                        >
                            <SlidersHorizontal className="h-4 w-4 mr-1" />
                            {advancedOpen ? 'Свернуть' : 'Расширенный'}
                            <ChevronDown
                                className={`h-4 w-4 ml-1 transition-transform ${
                                    advancedOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </Button>
                    </div>
                </div>
            </div>


            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    Ошибка загрузки вызовов
                </div>
            ) : (
                <div>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {orderedColumns.map((c) => (
                                        <TableHead key={c.key}>{c.label}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calls.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={orderedColumns.length}
                                            className="text-center text-slate-400 py-6"
                                        >
                                            Вызовов не найдено
                                        </TableCell>
                                    </TableRow>
                                )}
                                {calls.map((call) => {
                                    const rowClass =
                                        call.status === 'error'
                                            ? 'bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20'
                                            : call.status === 'closed'
                                                ? 'bg-green-100 hover:bg-green-200 dark:bg-green-500/10 dark:hover:bg-green-500/20'
                                                : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500/20';
                                    return (
                                        <TableRow
                                            key={call.id}
                                            className={`cursor-pointer ${rowClass}`}
                                            onClick={() => navigate(`/calls/${call.id}`)}
                                        >
                                            {orderedColumns.map((c) => (
                                                <TableCell key={c.key} className={cellClass(c.key)}>
                                                    {renderCell(call, c.key)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>


                    {/* Пагинация (pr-16 — чтобы кнопки не уходили под плавающую кнопку чата) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 pr-16">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Показывать:</span>
                            <NativeSelect
                                value={pageSize}
                                onChange={(e) => changePageSize(e.target.value)}
                                className="w-20"
                            >
                                {PAGE_SIZES.map((s) => (
                                    <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
                                ))}
                            </NativeSelect>
                            <span>
                                {total} всего · стр. {page} из {totalPages || 1}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg"
                            >
                                Назад
                            </Button>
                            {getPageItems(page, totalPages || 1).map((item, idx) =>
                                item === '…' ? (
                                    <span
                                        key={`gap-${idx}`}
                                        className="px-0.5 text-sm text-slate-400"
                                    >
                                        …
                                    </span>
                                ) : (
                                    <Button
                                        key={item}
                                        variant={item === page ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={item === page}
                                        onClick={() => setPage(item)}
                                        className="rounded-lg min-w-9"
                                    >
                                        {item}
                                    </Button>
                                )
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="rounded-lg"
                            >
                                Вперёд
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Диалог выбора отображаемых полей */}
            <CallsColumnsDialog
                open={columnsOpen}
                onOpenChange={setColumnsOpen}
                columns={columns}
                onChange={setColumns}
            />
        </div>
    );
};

export default CallsList;

