import { useState, useEffect, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Tree } from '@minoru/react-dnd-treeview';
import {
    useDepartments,
    useCreateDepartment,
    useUpdateDepartment,
    useDeleteDepartment,
    useReorderDepartments,
} from '../../hooks/useDepartments';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    Building2,
    GripVertical,
    ChevronRight,
    ChevronDown,
    MapPin,
    Phone,
} from 'lucide-react';
import DepartmentForm from '../../components/DepartmentForm';

const ROOT_ID = 'root';

// Нормализация данных: массив / { data: [...] } / undefined → массив
const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

const DepartmentsList = () => {
    const { data, isLoading, error } = useDepartments();
    const createDepartment = useCreateDepartment();
    const updateDepartment = useUpdateDepartment();
    const deleteDepartment = useDeleteDepartment();
    const reorderDepartments = useReorderDepartments();
    const { has } = usePermissions();

    const canCreate = has('departments.create');
    const canUpdate = has('departments.update');
    const canDelete = has('departments.delete');
    const canReorder = has('departments.reorder');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [departmentToDelete, setDepartmentToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const [treeData, setTreeData] = useState([]);

    const departments = useMemo(() => asArray(data), [data]);

    useEffect(() => {
        const formatted = departments.map((dept) => ({
            id: dept.id,
            parent: dept.parent_id || ROOT_ID,
            text: dept.name,
            droppable: true,
            data: dept,
        }));
        setTreeData(formatted);
    }, [departments]);

    const displayTree = useMemo(() => {
        if (!searchTerm.trim()) return treeData;
        const q = searchTerm.toLowerCase();
        return treeData
            .filter((n) => {
                const dept = n.data;
                return (
                    n.text.toLowerCase().includes(q) ||
                    dept?.full_name?.toLowerCase().includes(q) ||
                    dept?.address?.toLowerCase().includes(q) ||
                    dept?.phone?.toLowerCase().includes(q)
                );
            })
            .map((n) => ({ ...n, parent: ROOT_ID }));
    }, [treeData, searchTerm]);

    const isSearching = !!searchTerm.trim();

    // ---------- Drag & Drop ----------
    const handleDrop = (newTree) => {
        setTreeData(newTree);

        const counters = {};
        const updates = newTree.map((node) => {
            const parent = node.parent === ROOT_ID ? null : node.parent;
            const key = parent || '__root__';
            counters[key] = counters[key] || 0;
            const sortOrder = counters[key]++;
            return {
                id: node.id,
                parent_id: parent,
                sort_order: sortOrder,
            };
        });

        reorderDepartments.mutate(updates, {
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка сохранения порядка');
                setTreeData(
                    departments.map((dept) => ({
                        id: dept.id,
                        parent: dept.parent_id || ROOT_ID,
                        text: dept.name,
                        droppable: true,
                        data: dept,
                    }))
                );
            },
        });
    };

    const canDrop = (tree, { dragSource, dropTargetId }) => {
        if (!canReorder) return false;
        if (!dragSource) return false;
        if (dropTargetId === 0 || dropTargetId === ROOT_ID) return true;
        if (dragSource.id === dropTargetId) return false;

        const dropTarget = departments.find((d) => d.id === dropTargetId);

        // 1. Нельзя дропнуть в узел, который сам является ребёнком
        if (dropTarget?.parent_id) {
            return false;
        }

        // 2. Нельзя дропнуть в своего потомка
        const isDescendant = (childId, ancestorId) => {
            let currentId = childId;
            const visited = new Set();
            while (currentId) {
                if (visited.has(currentId)) return false;
                visited.add(currentId);
                if (currentId === ancestorId) return true;
                const node = departments.find((d) => d.id === currentId);
                if (!node) return false;
                currentId = node.parent_id;
            }
            return false;
        };
        if (isDescendant(dropTargetId, dragSource.id)) {
            return false;
        }

        // 3. Узел с детьми нельзя перемещать внутрь другого узла
        const sourceHasChildren = departments.some(
            (d) => d.parent_id === dragSource.id
        );
        if (sourceHasChildren) {
            return false;
        }

        return true;
    };

    // ---------- CRUD ----------
    const handleCreate = () => {
        setSelectedDepartment(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (dept) => {
        const original = departments.find((d) => d.id === dept.id);
        setSelectedDepartment(original || dept);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setDepartmentToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (departmentToDelete) {
            deleteDepartment.mutate(departmentToDelete, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDepartmentToDelete(null);
                },
                onError: (err) => {
                    alert(err.response?.data?.error || 'Ошибка удаления');
                },
            });
        }
    };

    const handleFormSubmit = (formData) => {
        setFormError('');

        if (selectedDepartment) {
            updateDepartment.mutate(
                { id: selectedDepartment.id, data: formData },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedDepartment(null);
                    },
                    onError: (err) => {
                        setFormError(
                            err.response?.data?.error || 'Ошибка обновления'
                        );
                    },
                }
            );
        } else {
            createDepartment.mutate(formData, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) => {
                    setFormError(err.response?.data?.error || 'Ошибка создания');
                },
            });
        }
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
                Ошибка загрузки подразделений
            </div>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            Подразделения
                        </h2>
                        <p className="text-sm text-slate-500">
                            Всего: {departments.length}.
                            {canReorder &&
                                ' Перетаскивайте элементы для изменения порядка и иерархии.'}
                        </p>
                    </div>
                    {canCreate && (
                        <Button
                            onClick={handleCreate}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить подразделение
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Поиск по названию, адресу или телефону..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 rounded-lg"
                        />
                    </div>
                    {isSearching && (
                        <span className="text-sm text-slate-500">
              В режиме поиска перетаскивание отключено
            </span>
                    )}
                </div>

                {displayTree.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                        <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                        <p>Нет подразделений</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <Tree
                            tree={displayTree}
                            rootId={ROOT_ID}
                            onDrop={handleDrop}
                            canDrop={isSearching || !canReorder ? () => false : canDrop}
                            sort={false}
                            insertDroppableFirst={false}
                            dropTargetOffset={20}
                            initialOpen={true}
                            placeholderRender={(node, { depth }) => (
                                <div
                                    className="h-1 bg-orange-400 rounded-full my-1"
                                    style={{ marginLeft: depth * 24 }}
                                />
                            )}
                            render={(node, { depth, isOpen, onToggle, hasChild }) => {
                                const dept = node.data;
                                return (
                                    <div
                                        className="flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 group"
                                        style={{ marginLeft: depth * 24 }}
                                    >
                                        {/* Сворачивание */}
                                        <button
                                            type="button"
                                            onClick={onToggle}
                                            className={`w-4 h-4 flex items-center justify-center transition-transform mt-1 flex-shrink-0 ${
                                                hasChild
                                                    ? 'text-slate-500'
                                                    : 'opacity-0 pointer-events-none'
                                            }`}
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </button>

                                        {/* Ручка */}
                                        {canReorder && !isSearching ? (
                                            <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-slate-500 cursor-grab mt-1 flex-shrink-0" />
                                        ) : (
                                            <div className="w-4 flex-shrink-0" />
                                        )}

                                        {/* Иконка */}
                                        <Building2 className="h-4 w-4 text-orange-500 flex-shrink-0 mt-1" />

                                        {/* Названия и контакты */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">
                          {dept?.name || node.text}
                        </span>
                                                {dept?.full_name && (
                                                    <span className="text-sm text-slate-500 truncate">
                            — {dept.full_name}
                          </span>
                                                )}
                                            </div>

                                            {/* Округ, адрес и телефон — во вторую строку */}
                                            {(dept?.municipality_name || dept?.address || dept?.phone) && (
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                                                    {dept.municipality_name && (
                                                        <span className="inline-flex items-center gap-1 font-medium text-orange-600">
                              <MapPin className="h-3 w-3 text-orange-400" />
                              {dept.municipality_name}
                            </span>
                                                    )}
                                                    {dept.address && (
                                                        <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-[400px]">
                                {dept.address}
                              </span>
                            </span>
                                                    )}
                                                    {dept.phone && (
                                                        <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 text-slate-400" />
                                                            {dept.phone}
                            </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Действия */}
                                        {(canUpdate || canDelete) && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                {canUpdate && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(dept || node)}
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
                                                        onClick={() => handleDelete(node.id)}
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                        title="Удалить"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    </div>
                )}

                <DepartmentForm
                    open={isFormOpen}
                    onOpenChange={(open) => {
                        setIsFormOpen(open);
                        if (!open) {
                            setFormError('');
                            setSelectedDepartment(null);
                        }
                    }}
                    onSubmit={handleFormSubmit}
                    initialData={selectedDepartment}
                    isLoading={
                        createDepartment.isPending || updateDepartment.isPending
                    }
                    error={formError}
                    departments={departments}
                />

                <AlertDialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                >
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Удаление подразделения</AlertDialogTitle>
                            <AlertDialogDescription>
                                Вы уверены, что хотите удалить это подразделение? Дочерние
                                подразделения станут корневыми. Это действие нельзя отменить.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">
                                Отмена
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                disabled={deleteDepartment.isPending}
                                className="bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                                {deleteDepartment.isPending ? 'Удаление...' : 'Удалить'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DndProvider>
    );
};

export default DepartmentsList;