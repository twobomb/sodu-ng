import { useState, useMemo } from 'react';
import {
    useUnitStatuses,
    useCreateUnitStatus,
    useUpdateUnitStatus,
    useDeleteUnitStatus,
} from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import {
    Loader2,
    Plus,
    Search,
    Edit,
    Trash2,
    Palette,
    Lock,
} from 'lucide-react';
import UnitStatusForm from '../../components/units/UnitStatusForm';

const UnitStatusesList = () => {
    const { has } = usePermissions();
    const { data: statuses, isLoading, error } = useUnitStatuses();
    const createStatus = useCreateUnitStatus();
    const updateStatus = useUpdateUnitStatus();
    const deleteStatus = useDeleteUnitStatus();

    const [search, setSearch] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const canManage = has('units.manage_dictionaries');

    const filtered = useMemo(() => {
        const list = statuses || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.short_name.toLowerCase().includes(q)
        );
    }, [statuses, search]);

    const handleCreate = () => {
        setSelectedStatus(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (status) => {
        setSelectedStatus(status);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleFormSubmit = (payload) => {
        setFormError('');
        if (selectedStatus) {
            updateStatus.mutate(
                { id: selectedStatus.id, data: payload },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedStatus(null);
                    },
                    onError: (err) =>
                        setFormError(err.response?.data?.error || 'Ошибка обновления'),
                }
            );
        } else {
            createStatus.mutate(payload, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) =>
                    setFormError(err.response?.data?.error || 'Ошибка создания'),
            });
        }
    };

    const confirmDelete = () => {
        if (!statusToDelete) return;
        deleteStatus.mutate(statusToDelete.id, {
            onSuccess: () => setStatusToDelete(null),
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка удаления');
                setStatusToDelete(null);
            },
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки статусов
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Статусы техники</h2>
                    <p className="text-sm text-slate-500">Всего: {filtered.length}</p>
                </div>
                {canManage && (
                    <Button
                        onClick={handleCreate}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить статус
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по названию..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <Palette className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Нет статусов</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Цвет</TableHead>
                                <TableHead>Сокращённое</TableHead>
                                <TableHead>Полное название</TableHead>
                                <TableHead>Техника</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((status) => (
                                <TableRow key={status.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-6 w-6 rounded-md border border-slate-200"
                                                style={{ backgroundColor: status.color }}
                                            />
                                            <span className="text-xs text-slate-500">
                        {status.color_name || status.color}
                      </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{status.short_name}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {status.name}
                                            {status.is_system && (
                                                <Lock
                                                    className="h-3 w-3 text-slate-400"
                                                    title="Системный статус"
                                                />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {status.units_count > 0 ? (
                                            <span className="text-sm text-slate-600">
                        {status.units_count} ед.
                      </span>
                                        ) : (
                                            <span className="text-sm text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canManage && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(status)}
                                                    className="h-8 w-8 p-0"
                                                    title="Редактировать"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setStatusToDelete(status)}
                                                    disabled={status.is_system || status.units_count > 0}
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 disabled:opacity-30"
                                                    title={
                                                        status.is_system
                                                            ? 'Системный статус нельзя удалить'
                                                            : status.units_count > 0
                                                                ? 'Нельзя удалить: используется техникой'
                                                                : 'Удалить'
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <UnitStatusForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setSelectedStatus(null);
                        setFormError('');
                    }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedStatus}
                isLoading={createStatus.isPending || updateStatus.isPending}
                error={formError}
            />

            <AlertDialog
                open={!!statusToDelete}
                onOpenChange={(o) => !o && setStatusToDelete(null)}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить статус?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Статус «{statusToDelete?.name}» будет удалён навсегда. Это
                            действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteStatus.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteStatus.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UnitStatusesList;