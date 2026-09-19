import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalls, useCreateCall, useMunicipalities } from '../../hooks/useCalls';
import { usePermissions } from '../../hooks/usePermissions';
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
import { FilterX, Loader2, Plus, Search, Siren } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

const CallsList = () => {
    const navigate = useNavigate();
    const { has } = usePermissions();
    const createCall = useCreateCall();

    // Фильтры
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [municipalityFilter, setMunicipalityFilter] = useState('all');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');

    // Пагинация
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const munisQuery = useMunicipalities();

    const { data, isLoading, error } = useCalls({
        search: searchTerm || undefined,
        status: statusFilter,
        type: typeFilter,
        municipality: municipalityFilter,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        page,
        pageSize,
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

    const hasActiveFilters =
        searchTerm !== '' ||
        statusFilter !== 'all' ||
        typeFilter !== 'all' ||
        municipalityFilter !== 'all' ||
        createdFrom !== '' ||
        createdTo !== '';

    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setTypeFilter('all');
        setMunicipalityFilter('all');
        setCreatedFrom('');
        setCreatedTo('');
        setPage(1);
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

            {/* Фильтры */}
            <div className="grid gap-2 sm:grid-cols-3 items-end">
                <div className="space-y-2">
                    <Label>Поиск</Label>
                    <div className="relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                            placeholder="Адрес, округ, описание..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg pl-8"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Округ</Label>
                    <SearchableSelect
                        options={municipalityOptions}
                        value={municipalityFilter}
                        onChange={(v) => {
                            setMunicipalityFilter(v);
                            setPage(1);
                        }}
                        placeholder="Выберите округ..."
                        emptyText="Округов не найдено"
                        className="w-full"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Статус</Label>
                    <NativeSelect
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
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
                <div className="space-y-2">
                    <Label>Тип вызова</Label>
                    <NativeSelect
                        value={typeFilter}
                        onChange={(e) => {
                            setTypeFilter(e.target.value);
                            setPage(1);
                        }}
                        className="w-full"
                    >
                        <NativeSelectOption value="all">Все типы</NativeSelectOption>
                        {CALL_TYPES.map((t) => (
                            <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                        ))}
                    </NativeSelect>
                </div>
                <div className="space-y-2">
                    <Label>Создан от</Label>
                    <Input
                        type="date"
                        value={createdFrom}
                        max={createdTo || undefined}
                        onChange={(e) => {
                            setCreatedFrom(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Создан до</Label>
                    <Input
                        type="date"
                        value={createdTo}
                        min={createdFrom || undefined}
                        onChange={(e) => {
                            setCreatedTo(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveFilters}
                    onClick={resetFilters}
                    className="rounded-lg"
                >
                    <FilterX className="h-4 w-4 mr-2" />
                    Сбросить фильтры
                </Button>
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
                                    <TableHead className="w-[1%] whitespace-nowrap">Идентификатор</TableHead>
                                    <TableHead>Создан</TableHead>
                                    <TableHead>Адрес</TableHead>
                                    <TableHead>Округ</TableHead>
                                    <TableHead>Тип</TableHead>
                                    <TableHead>Техника</TableHead>
                                    <TableHead>Статус</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calls.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-slate-400 py-6">
                                            Вызовов не найдено
                                        </TableCell>
                                    </TableRow>
                                )}
                                {calls.map((call) => {
                                    const statusMeta = CALL_STATUS_META[call.status] || { label: call.status, badge: 'bg-slate-500' };
                                    const rowClass =
                                        call.status === 'error'
                                            ? 'bg-red-100 hover:bg-red-200'
                                            : call.status === 'closed'
                                                ? 'bg-green-100 hover:bg-green-200'
                                                : 'bg-blue-100 hover:bg-blue-200';
                                    return (
                                        <TableRow
                                            key={call.id}
                                            className={`cursor-pointer ${rowClass}`}
                                            onClick={() => navigate(`/calls/${call.id}`)}
                                        >
                                            <TableCell className="whitespace-nowrap font-medium text-slate-800">
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-4 w-4 rounded-sm border border-slate-300"
                                                        style={{ backgroundColor: call.color || '#e42525' }}
                                                        title={call.color || ''}
                                                    />
                                                    {call.call_code || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {formatDateTime(call.created_at)}
                                            </TableCell>
                                            <TableCell>{call.address || '—'}</TableCell>
                                            <TableCell>{call.municipality_name || '—'}</TableCell>
                                            <TableCell>{call.type || '—'}</TableCell>
                                            <TableCell>{call.units_count || 0}</TableCell>
                                            <TableCell>
                                                <Badge className={`${statusMeta.badge} text-white`}>
                                                    {statusMeta.label}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Пагинация */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
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
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg"
                            >
                                Назад
                            </Button>
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
        </div>
    );
};

export default CallsList;


