import { useState, useMemo } from 'react';
import {
    useUnits,
    useDeleteUnit,
    useChangeUnitStatus,
    useUnitStatuses,
    useCreateUnit,
    useUpdateUnit,
} from '../../hooks/useUnits';
import { useDepartments } from '../../hooks/useDepartments';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
    EyeOff,
    X,
    MoreVertical,
} from 'lucide-react';
import UnitForm from '../../components/UnitForm';
import SearchableSelect from '@/components/ui/searchable-select';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

const UnitsList = () => {
    const { has } = usePermissions();
    const { data, isLoading, error } = useUnits();
    const { data: deptData, isLoading: deptsLoading } = useDepartments();
    const { data: statuses } = useUnitStatuses();

    const createUnit = useCreateUnit();
    const updateUnit = useUpdateUnit();
    const deleteUnit = useDeleteUnit();
    const changeStatus = useChangeUnitStatus();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');

    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const canEdit = has('units.update');
    const canDelete = has('units.delete');
    const canCreate = has('units.create');
    const canChangeStatus = has('units.update_status');

    const units = asArray(data);
    const departments = asArray(deptData);
    const statusList = asArray(statuses);

    // Опции для SearchableSelect подразделений
    const deptOptions = useMemo(
        () => [
            { value: 'all', label: 'Все подразделения' },
            ...departments.map((d) => ({
                value: d.id,
                label: d.name,
                extra: d.full_name || '',
                search: `${d.name} ${d.full_name || ''}`.toLowerCase(),
            })),
        ],
        [departments]
    );

    const filteredUnits = useMemo(() => {
        return units.filter((unit) => {
            const q = searchTerm.toLowerCase();
            const matchesSearch =
                unit.name?.toLowerCase().includes(q) ||
                unit.plate_number?.toLowerCase().includes(q) ||
                unit.type_short_name?.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === 'all' || unit.status_id === statusFilter;
            const matchesDept =
                deptFilter === 'all' || unit.department_id === deptFilter;
            return matchesSearch && matchesStatus && matchesDept;
        });
    }, [units, searchTerm, statusFilter, deptFilter]);

    const handleCreate = () => {
        setSelectedUnit(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (unit) => {
        setSelectedUnit(unit);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setUnitToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (unitToDelete) {
            deleteUnit.mutate(unitToDelete, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setUnitToDelete(null);
                },
                onError: (err) =>
                    alert(err.response?.data?.error || 'Ошибка удаления'),
            });
        }
    };

    const handleStatusChange = (unit, statusId) => {
        changeStatus.mutate(
            { id: unit.id, data: { status_id: statusId } },
            {
                onError: (err) =>
                    alert(err.response?.data?.error || 'Ошибка смены статуса'),
            }
        );
    };

    const handleFormSubmit = (payload) => {
        setFormError('');
        if (selectedUnit) {
            updateUnit.mutate(
                { id: selectedUnit.id, data: payload },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedUnit(null);
                    },
                    onError: (err) =>
                        setFormError(err.response?.data?.error || 'Ошибка обновления'),
                }
            );
        } else {
            createUnit.mutate(payload, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) =>
                    setFormError(err.response?.data?.error || 'Ошибка создания'),
            });
        }
    };

    if (isLoading || deptsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки техники
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Заголовок */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Техника</h2>
                    <p className="text-sm text-slate-500">
                        Всего: {filteredUnits.length}
                    </p>
                </div>
                {canCreate && (
                    <Button
                        onClick={handleCreate}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Новая техника
                    </Button>
                )}
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по названию, госномеру или типу..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>

                {/* Фильтр по подразделению — SearchableSelect */}
                <div className="w-[260px]">
                    <SearchableSelect
                        options={deptOptions}
                        value={deptFilter}
                        onChange={setDeptFilter}
                        placeholder="Все подразделения"
                        renderOption={(opt) => (
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm truncate">{opt.label}</span>
                                {opt.extra && (
                                    <span className="text-[11px] text-slate-400 truncate">
                    {opt.extra}
                  </span>
                                )}
                            </div>
                        )}
                    />
                </div>

                {/* Фильтр по статусу — оставляем обычный Select */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[220px] rounded-lg">
                        <SelectValue placeholder="Все статусы" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        {statusList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                  <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                  />
                                    {s.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Сброс фильтров */}
                {(deptFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDeptFilter('all');
                            setStatusFilter('all');
                            setSearchTerm('');
                        }}
                        className="h-9 rounded-lg gap-1.5 text-slate-600"
                    >
                        <X className="h-3.5 w-3.5" />
                        Сбросить
                    </Button>
                )}
            </div>

            {/* Таблица */}
            {filteredUnits.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <p>Нет техники, соответствующей фильтрам</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead>Госномер</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Отделение</TableHead>
                                <TableHead>Подразделение</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUnits.map((unit) => (
                                <TableRow key={unit.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {unit.name}
                                            {unit.show_in_grid === false && (
                                                <span title="Скрыта из сетки">
                          <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                        </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {unit.type_short_name ? (
                                            <Badge
                                                variant="outline"
                                                className="font-mono text-xs"
                                                title={unit.type_name}
                                            >
                                                {unit.type_short_name}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {unit.plate_number || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {unit.status_id ? (
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger
                                                    asChild
                                                    disabled={!canChangeStatus}
                                                >
                                                    <button
                                                        type="button"
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white transition-opacity ${
                                                            canChangeStatus
                                                                ? 'hover:opacity-90 cursor-pointer'
                                                                : 'cursor-default'
                                                        }`}
                                                        style={{ backgroundColor: unit.status_color }}
                                                        title={
                                                            canChangeStatus
                                                                ? 'Нажмите, чтобы сменить статус'
                                                                : unit.status_name
                                                        }
                                                    >
                                                        <span>{unit.status_short_name}</span>
                                                        {canChangeStatus && (
                                                            <MoreVertical className="h-3 w-3 opacity-70" />
                                                        )}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="start"
                                                    sideOffset={4}
                                                    collisionPadding={16}
                                                    className="min-w-[220px] z-[100]"
                                                >
                                                    <DropdownMenuLabel>Сменить статус</DropdownMenuLabel>
                                                    {statusList.map((s) => {
                                                        const isCurrent = s.id === unit.status_id;
                                                        return (
                                                            <DropdownMenuItem
                                                                key={s.id}
                                                                disabled={isCurrent}
                                                                onClick={() =>
                                                                    !isCurrent && handleStatusChange(unit, s.id)
                                                                }
                                                            >
                                                                <div className="flex items-center gap-2">
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
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {unit.squad_number ? (
                                            <Badge variant="outline">{unit.squad_number}</Badge>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {unit.department_name || '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(unit)}
                                                className="h-8 w-8 p-0"
                                                title="Редактировать"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(unit.id)}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                title="Удалить"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <UnitForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setFormError('');
                        setSelectedUnit(null);
                    }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedUnit}
                isEdit={!!selectedUnit}
                isLoading={createUnit.isPending || updateUnit.isPending}
                error={formError}
                departments={departments}
            />

            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление техники</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы уверены, что хотите удалить эту технику? Вся история статусов
                            будет также удалена. Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteUnit.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteUnit.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UnitsList;