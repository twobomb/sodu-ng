import { useState, useMemo, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
    useUnits,
    useDeleteUnit,
    useChangeUnitStatus,
    useUnitStatuses,
    useUnitTypes,
    useCreateUnit,
    useUpdateUnit,
    useReorderUnits,
    useAvailableCalls,
} from '../../hooks/useUnits';
import { useDepartments } from '../../hooks/useDepartments';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    History,
    Gauge,
    GripVertical,
    MousePointer2,
} from 'lucide-react';
import UnitForm from '../../components/UnitForm';
import SearchableSelect from '@/components/ui/searchable-select';
import UnitMetricsHistoryDialog from '../../components/units/UnitMetricsHistoryDialog';
import UnitMetricsEditDialog from '../../components/units/UnitMetricsEditDialog';
import UnitStatusDialog from '../../components/units/UnitStatusDialog';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

// Перетаскиваемая карточка техники (только внутри своего подразделения)
const DraggableUnit = ({ unit, deptId, onReorder, canDrag, children }) => {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: 'UNIT',
        item: { id: unit.id, deptId },
        canDrag: () => !!canDrag,
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }), [unit.id, deptId, canDrag]);

    const [, dropRef] = useDrop(() => ({
        accept: 'UNIT',
        drop: (item) => {
            if (item.deptId === deptId && item.id !== unit.id) onReorder(item.id, unit.id);
        },
    }), [unit.id, deptId, onReorder]);

    const ref = (node) => {
        dragRef(node);
        dropRef(node);
    };

    return (
        <div
            ref={ref}
            className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 transition-colors ${
                isDragging ? 'opacity-40 border-orange-200' : 'hover:bg-slate-50'
            }`}
        >
            {canDrag && (
                <GripVertical className="h-4 w-4 text-slate-300 cursor-grab flex-shrink-0" title="Перетащить" />
            )}
            {children}
        </div>
    );
};

const UnitsList = () => {
    const { has } = usePermissions();
    const { data, isLoading, error } = useUnits();
    const { data: deptData, isLoading: deptsLoading } = useDepartments();
    const { data: statuses } = useUnitStatuses();
    const { data: typesData } = useUnitTypes();
    const { data: availableCalls } = useAvailableCalls();

    const units = asArray(data);
    const departments = asArray(deptData);
    const statusList = asArray(statuses);
    const types = asArray(typesData);

    const canEdit = has('units.update');
    const canDelete = has('units.delete');
    const canCreate = has('units.create');
    const canChangeStatus = has('units.update_status');
    const canViewHistory = has('units.view_history');
    const canEditMetrics = has('units.update_metrics');

    const createUnit = useCreateUnit();
    const updateUnit = useUpdateUnit();
    const deleteUnit = useDeleteUnit();
    const changeStatus = useChangeUnitStatus();
    const reorderUnitsMut = useReorderUnits();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);
    const [formError, setFormError] = useState('');
    const [metricsUnit, setMetricsUnit] = useState(null);
    const [metricsEditUnit, setMetricsEditUnit] = useState(null);
    const [statusUnit, setStatusUnit] = useState(null);
    const [statusError, setStatusError] = useState('');

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

    // Опции для SearchableSelect: тип техники (с поиском)
    const typeOptions = useMemo(
        () => [
            { value: 'all', label: 'Все типы', extra: '' },
            ...types.map((t) => ({
                value: t.id,
                label: t.short_name || t.name || t.id,
                extra: t.name || '',
                search: `${t.short_name || ''} ${t.name || ''}`.toLowerCase(),
            })),
        ],
        [types]
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
            const matchesType =
                typeFilter === 'all' || unit.type_id === typeFilter;
            return matchesSearch && matchesStatus && matchesDept && matchesType;
        });
    }, [units, searchTerm, statusFilter, deptFilter, typeFilter]);

    // Локальный порядок юнитов (синхронизируется с выборкой, позволяет drag-перестановку)
    const [localUnits, setLocalUnits] = useState([]);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalUnits(filteredUnits);
    }, [filteredUnits]);

    const groups = useMemo(() => {
        const map = new Map();
        for (const u of localUnits) {
            if (!map.has(u.department_id)) {
                map.set(u.department_id, {
                    id: u.department_id,
                    name: u.department_name || 'Без подразделения',
                    units: [],
                });
            }
            map.get(u.department_id).units.push(u);
        }
        return [...map.values()];
    }, [localUnits]);

    const handleReorder = (dragId, overId) => {
        setLocalUnits((prev) => {
            const arr = [...prev];
            const from = arr.findIndex((u) => u.id === dragId);
            const to = arr.findIndex((u) => u.id === overId);
            if (from < 0 || to < 0) return prev;
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            const deptId = moved.department_id;
            const ids = arr.filter((u) => u.department_id === deptId).map((u) => u.id);
            reorderUnitsMut.mutate(ids);
            return arr;
        });
    };

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

    const handleStatusSubmit = (unit, payload) => {
        setStatusError('');
        changeStatus.mutate(
            {
                id: unit.id,
                data: {
                    status_id: payload.status_id,
                    call_id: payload.call_id,
                    add_event: payload.add_event,
                },
            },
            {
                onError: (err) =>
                    setStatusError(err.response?.data?.error || 'Ошибка смены статуса'),
                onSuccess: () => setStatusUnit(null),
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
                    <p className="text-sm text-slate-500">Всего: {localUnits.length}</p>
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

                <div className="w-[220px]">
                    <SearchableSelect
                        options={typeOptions}
                        value={typeFilter}
                        onChange={setTypeFilter}
                        placeholder="Все типы"
                    />
                </div>

                <div className="w-[260px]">
                    <SearchableSelect
                        options={deptOptions}
                        value={deptFilter}
                        onChange={setDeptFilter}
                        placeholder="Все подразделения"
                    />
                </div>

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

                {(deptFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDeptFilter('all');
                            setStatusFilter('all');
                            setTypeFilter('all');
                            setSearchTerm('');
                        }}
                        className="h-9 rounded-lg gap-1.5 text-slate-600"
                    >
                        <X className="h-3.5 w-3.5" />
                        Сбросить
                    </Button>
                )}
            </div>
{/* Группы подразделений */}
            {groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <p>Нет техники, соответствующей фильтрам</p>
                </div>
            ) : (
                <DndProvider backend={HTML5Backend}>
                    <div className="space-y-4">
                        {groups.map((g) => (
                            <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">{g.name}</h3>
                                    <span className="text-xs text-slate-400">{g.units.length} ед.</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {g.units.map((unit) => (
                                        <DraggableUnit
                                            key={unit.id}
                                            unit={unit}
                                            deptId={g.id}
                                            canDrag={canEdit}
                                            onReorder={handleReorder}
                                        >
                                            <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-800 truncate">
                                                            {unit.name}
                                                        </span>
                                                        {unit.show_in_grid === false && (
                                                            <span title="Скрыта из сетки">
                                                                <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                        {unit.type_short_name && (
                                                            <Badge
                                                                variant="outline"
                                                                className="font-mono text-xs"
                                                                title={unit.type_name}
                                                            >
                                                                {unit.type_short_name}
                                                            </Badge>
                                                        )}
                                                        <span className="font-mono">{unit.plate_number || '—'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
{unit.status_id ? (
                                                        <button
                                                            type="button"
                                                            disabled={!canChangeStatus}
                                                            onClick={() => {
                                                                setStatusError('');
                                                                setStatusUnit(unit);
                                                            }}
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
                                                                <MousePointer2 className="h-3 w-3 opacity-70" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">—</span>
                                                    )}
{canEditMetrics && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setMetricsEditUnit(unit)}
                                                            className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                                            title="Редактировать показатели"
                                                        >
                                                            <Gauge className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canViewHistory && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setMetricsUnit(unit)}
                                                            className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                                            title="История показателей"
                                                        >
                                                            <History className="h-4 w-4" />
                                                        </Button>
                                                    )}
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
                                                </div>
                                            </div>
                                        </DraggableUnit>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DndProvider>
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

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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

            <UnitMetricsHistoryDialog
                open={!!metricsUnit}
                onOpenChange={(open) => {
                    if (!open) setMetricsUnit(null);
                }}
                unit={metricsUnit}
            />

            <UnitMetricsEditDialog
                open={!!metricsEditUnit}
                onOpenChange={(open) => {
                    if (!open) setMetricsEditUnit(null);
                }}
                unit={metricsEditUnit}
            />

            <UnitStatusDialog
                open={!!statusUnit}
                onOpenChange={(open) => {
                    if (!open) {
                        setStatusUnit(null);
                        setStatusError('');
                    }
                }}
                unitName={statusUnit?.name}
                statuses={statusList}
                calls={Array.isArray(availableCalls) ? availableCalls : []}
                currentStatusId={statusUnit?.status_id}
                defaultCallId={statusUnit?.call_id || ''}
                onSubmit={(payload) => handleStatusSubmit(statusUnit, payload)}
                pending={changeStatus.isPending}
                error={statusError || undefined}
            />
        </div>
    );
};

export default UnitsList;