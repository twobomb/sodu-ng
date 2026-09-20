import { useState, useMemo, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
    useUnitTypes,
    useCreateUnitType,
    useUpdateUnitType,
    useDeleteUnitType,
    useReorderUnitTypes,
} from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    GripVertical,
    X,
} from 'lucide-react';
import UnitTypeForm from '../../components/units/UnitTypeForm';

const UNIT_CATEGORIES = [
    'Основная техника',
    'Специальная техника',
    'Вспомогательная техника',
    'Пожарный поезд',
    'Приспособленная и другая',
];

// Перетаскиваемая карточка типа (только внутри своей категории)
const DraggableUnitType = ({ type, category, onReorder, canDrag, children }) => {
    const [{ isDragging }, dragRef] = useDrag(
        () => ({
            type: 'UNIT_TYPE',
            item: { id: type.id, category },
            canDrag: () => !!canDrag,
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [type.id, category, canDrag]
    );

    const [, dropRef] = useDrop(
        () => ({
            accept: 'UNIT_TYPE',
            drop: (item) => {
                if (item.category === category && item.id !== type.id) {
                    onReorder(item.id, type.id);
                }
            },
        }),
        [type.id, category, onReorder]
    );

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
                <GripVertical
                    className="h-4 w-4 text-slate-300 cursor-grab flex-shrink-0"
                    title="Перетащить для сортировки"
                />
            )}
            {children}
        </div>
    );
};

const UnitTypesList = () => {
    const { has } = usePermissions();
    const { data: types, isLoading, error } = useUnitTypes();
    const createType = useCreateUnitType();
    const updateType = useUpdateUnitType();
    const deleteType = useDeleteUnitType();
    const reorderMut = useReorderUnitTypes();

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

    // Локальный порядок (синхронизируется с выборкой, позволяет drag-перестановку)
    const [localTypes, setLocalTypes] = useState([]);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalTypes(filtered);
    }, [filtered]);

    const groups = useMemo(() => {
        const result = UNIT_CATEGORIES.map((category) => ({
            category,
            name: category,
            types: localTypes.filter((t) => t.category === category),
        })).filter((g) => g.types.length > 0);

        const withoutCategory = localTypes.filter(
            (t) => !UNIT_CATEGORIES.includes(t.category)
        );
        if (withoutCategory.length) {
            result.push({
                category: '__other__',
                name: 'Без категории',
                types: withoutCategory,
            });
        }
        return result;
    }, [localTypes]);

    const handleReorder = (dragId, overId) => {
        setLocalTypes((prev) => {
            const arr = [...prev];
            const from = arr.findIndex((t) => t.id === dragId);
            const to = arr.findIndex((t) => t.id === overId);
            if (from < 0 || to < 0) return prev;

            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);

            const category = moved.category;
            if (UNIT_CATEGORIES.includes(category)) {
                const ids = arr
                    .filter((t) => t.category === category)
                    .map((t) => t.id);
                reorderMut.mutate({ category, unitTypeIds: ids });
            }
            return arr;
        });
    };

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
                {search.trim() && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearch('')}
                        className="h-9 rounded-lg gap-1.5 text-slate-600"
                    >
                        <X className="h-3.5 w-3.5" />
                        Сбросить
                    </Button>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Нет типов техники</p>
                </div>
            ) : (
                <DndProvider backend={HTML5Backend}>
                    <div className="space-y-4">
                        {groups.map((g) => (
                            <div key={g.category} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">{g.name}</h3>
                                    <span className="text-xs text-slate-400">{g.types.length} тип.</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {g.types.map((type) => (
                                        <DraggableUnitType
                                            key={type.id}
                                            type={type}
                                            category={g.category}
                                            canDrag={canManage && UNIT_CATEGORIES.includes(type.category)}
                                            onReorder={handleReorder}
                                        >
                                            <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-800 truncate">
                                                            {type.name}
                                                        </span>
                                                        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                                            {type.short_name}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                        {type.show_in_line_note ? (
                                                            <span className="text-emerald-600">
                                                                Отображается в строевой записке
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">
                                                                Скрыт из строевой записки
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
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
                                                </div>
                                            </div>
                                        </DraggableUnitType>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DndProvider>
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