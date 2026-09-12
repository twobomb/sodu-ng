import { useState, useMemo } from 'react';
import {
    useUnitTypes,
    useCreateUnitType,
    useUpdateUnitType,
    useDeleteUnitType,
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
    Truck,
} from 'lucide-react';
import UnitTypeForm from '../../components/units/UnitTypeForm';

const UnitTypesList = () => {
    const { has } = usePermissions();
    const { data: types, isLoading, error } = useUnitTypes();
    const createType = useCreateUnitType();
    const updateType = useUpdateUnitType();
    const deleteType = useDeleteUnitType();

    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [typeToDelete, setTypeToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const canManage = has('units.manage_dictionaries');

    const filtered = useMemo(() => {
        const list = types || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                t.short_name.toLowerCase().includes(q)
        );
    }, [types, search]);

    const handleCreate = () => {
        setSelectedType(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (type) => {
        setSelectedType(type);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleFormSubmit = (payload) => {
        setFormError('');
        if (selectedType) {
            updateType.mutate(
                { id: selectedType.id, data: payload },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedType(null);
                    },
                    onError: (err) =>
                        setFormError(err.response?.data?.error || 'Ошибка обновления'),
                }
            );
        } else {
            createType.mutate(payload, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) =>
                    setFormError(err.response?.data?.error || 'Ошибка создания'),
            });
        }
    };

    const confirmDelete = () => {
        if (!typeToDelete) return;
        deleteType.mutate(typeToDelete.id, {
            onSuccess: () => setTypeToDelete(null),
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка удаления');
                setTypeToDelete(null);
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
                Ошибка загрузки типов техники
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Типы техники</h2>
                    <p className="text-sm text-slate-500">Всего: {filtered.length}</p>
                </div>
                {canManage && (
                    <Button
                        onClick={handleCreate}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить тип
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по названию или сокращению..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Нет типов техники</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Сокращённое</TableHead>
                                <TableHead>Полное название</TableHead>
                                <TableHead>Используется</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((type) => (
                                <TableRow key={type.id}>
                                    <TableCell>
                                        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                            {type.short_name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{type.name}</TableCell>
                                    <TableCell>
                                        {type.units_count > 0 ? (
                                            <span className="text-sm text-slate-600">
                        {type.units_count} ед.
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
                                                    onClick={() => handleEdit(type)}
                                                    className="h-8 w-8 p-0"
                                                    title="Редактировать"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setTypeToDelete(type)}
                                                    disabled={type.units_count > 0}
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 disabled:opacity-30"
                                                    title={
                                                        type.units_count > 0
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

            <UnitTypeForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setSelectedType(null);
                        setFormError('');
                    }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedType}
                isLoading={createType.isPending || updateType.isPending}
                error={formError}
            />

            <AlertDialog
                open={!!typeToDelete}
                onOpenChange={(o) => !o && setTypeToDelete(null)}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить тип?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Тип «{typeToDelete?.name}» будет удалён навсегда. Это действие
                            нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteType.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteType.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UnitTypesList;