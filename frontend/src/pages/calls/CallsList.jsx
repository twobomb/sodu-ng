import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalls, useCreateCall } from '../../hooks/useCalls';
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
import { Loader2, Plus, Search, Siren } from 'lucide-react';

const CallsList = () => {
    const navigate = useNavigate();
    const { has } = usePermissions();
    const createCall = useCreateCall();

    // Фильтры
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const { data, isLoading, error } = useCalls({
        search: searchTerm || undefined,
        status: statusFilter,
        type: typeFilter,
    });

    const calls = Array.isArray(data) ? data : (data?.data || []);

    const handleCreate = () => {
        if (createCall.isPending) return;
        createCall.mutate(undefined, {
            onSuccess: (created) => {
                const id = created?.data?.id || created?.id;
                if (id) navigate(`/calls/${id}`);
            },
        });
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
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="rounded-lg pl-8"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Статус</Label>
                    <NativeSelect
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
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
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="w-full"
                    >
                        <NativeSelectOption value="all">Все типы</NativeSelectOption>
                        {CALL_TYPES.map((t) => (
                            <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                        ))}
                    </NativeSelect>
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
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Создан</TableHead>
                                <TableHead>Событие</TableHead>
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
                                return (
                                    <TableRow
                                        key={call.id}
                                        className="cursor-pointer hover:bg-slate-50"
                                        onClick={() => navigate(`/calls/${call.id}`)}
                                    >
                                        <TableCell className="whitespace-nowrap">
                                            {formatDateTime(call.created_at)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {formatDateTime(call.incident_at)}
                                        </TableCell>
                                        <TableCell>{call.address || '—'}</TableCell>
                                        <TableCell>{call.municipality || '—'}</TableCell>
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
            )}
        </div>
    );
};

export default CallsList;