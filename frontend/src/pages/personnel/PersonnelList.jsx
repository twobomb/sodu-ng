import { useState, useMemo, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
    usePersonnel,
    useCreatePerson,
    useUpdatePerson,
    useDeletePerson,
    useReorderPersonnel,
} from '../../hooks/usePersonnel';
import { useDepartments } from '../../hooks/useDepartments';
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
    GripVertical,
    Phone,
    Truck,
} from 'lucide-react';
import PersonnelForm from '../../components/personnel/PersonnelForm';
import SearchableSelect from '@/components/ui/searchable-select';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

// Перетаскиваемая строка человека (только внутри своего подразделения)
const DraggablePerson = ({ person, deptId, onReorder, canDrag, children }) => {
    const [{ isDragging }, dragRef] = useDrag(
        () => ({
            type: 'PERSONNEL',
            item: { id: person.id, deptId },
            canDrag: () => !!canDrag,
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [person.id, deptId, canDrag]
    );

    const [, dropRef] = useDrop(
        () => ({
            accept: 'PERSONNEL',
            drop: (item) => {
                if (item.deptId === deptId && item.id !== person.id) onReorder(item.id, person.id);
            },
        }),
        [person.id, deptId, onReorder]
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
                <GripVertical className="h-4 w-4 text-slate-300 cursor-grab flex-shrink-0" title="Перетащить" />
            )}
            {children}
        </div>
    );
};

const PersonnelList = () => {
    const { has } = usePermissions();
    const { data, isLoading, error } = usePersonnel();
    const { data: deptData } = useDepartments();

    const people = asArray(data);
    const departments = asArray(deptData);

    const canEdit = has('personnel.update');
    const canDelete = has('personnel.delete');
    const canCreate = has('personnel.create');

    const createPerson = useCreatePerson();
    const updatePerson = useUpdatePerson();
    const deletePerson = useDeletePerson();
    const reorderMut = useReorderPersonnel();

    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [personToDelete, setPersonToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    // Порядок подразделений — как в справочнике подразделений
    const deptOrder = useMemo(() => {
        const m = new Map();
        departments.forEach((d, i) => m.set(d.id, i));
        return m;
    }, [departments]);

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

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return people.filter((p) => {
            const matchesSearch =
                !q ||
                (p.full_name || '').toLowerCase().includes(q) ||
                (p.position || '').toLowerCase().includes(q) ||
                (p.rank_name || '').toLowerCase().includes(q) ||
                (p.phone || '').toLowerCase().includes(q);
            const matchesDept = deptFilter === 'all' || p.department_id === deptFilter;
            return matchesSearch && matchesDept;
        });
    }, [people, searchTerm, deptFilter]);

    // Локальный порядок (для drag-перестановки)
    const [localList, setLocalList] = useState([]);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalList(filtered);
    }, [filtered]);

    const groups = useMemo(() => {
        const map = new Map();
        for (const p of localList) {
            if (!map.has(p.department_id)) {
                map.set(p.department_id, {
                    id: p.department_id,
                    name: p.department_name || 'Без подразделения',
                    people: [],
                });
            }
            map.get(p.department_id).people.push(p);
        }
        return [...map.values()].sort(
            (a, b) => (deptOrder.get(a.id) ?? 1e9) - (deptOrder.get(b.id) ?? 1e9)
        );
    }, [localList, deptOrder]);

    const handleReorder = (dragId, overId) => {
        setLocalList((prev) => {
            const arr = [...prev];
            const from = arr.findIndex((p) => p.id === dragId);
            const to = arr.findIndex((p) => p.id === overId);
            if (from < 0 || to < 0) return prev;
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            const deptId = moved.department_id;
            const ids = arr.filter((p) => p.department_id === deptId).map((p) => p.id);
            reorderMut.mutate(ids);
            return arr;
        });
    };

    const handleCreate = () => {
        setSelectedPerson(null);
        setFormError('');
        setIsFormOpen(true);
    };
    const handleEdit = (person) => {
        setSelectedPerson(person);
        setFormError('');
        setIsFormOpen(true);
    };
    const confirmDelete = () => {
        if (!personToDelete) return;
        deletePerson.mutate(personToDelete.id, {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setPersonToDelete(null);
            },
            onError: (err) => alert(err.response?.data?.error || 'Ошибка удаления'),
        });
    };
    const handleFormSubmit = (payload) => {
        setFormError('');
        if (selectedPerson) {
            updatePerson.mutate(
                { id: selectedPerson.id, data: payload },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedPerson(null);
                    },
                    onError: (err) =>
                        setFormError(err.response?.data?.error || 'Ошибка обновления'),
                }
            );
        } else {
            createPerson.mutate(payload, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) => setFormError(err.response?.data?.error || 'Ошибка создания'),
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
                Ошибка загрузки личного состава
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Заголовок */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Личный состав</h2>
                    <p className="text-sm text-slate-500">Всего: {localList.length}</p>
                </div>
                {canCreate && (
                    <Button
                        onClick={handleCreate}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Новый человек
                    </Button>
                )}
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по ФИО, должности, званию, телефону..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
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
            </div>

            {localList.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate-400">
                    Личный состав не найден
                </div>
            ) : (
                <DndProvider backend={HTML5Backend}>
                    <div className="space-y-4">
                        {groups.map((g) => (
                            <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">{g.name}</h3>
                                    <span className="text-xs text-slate-400">{g.people.length} чел.</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {g.people.map((person) => (
                                        <DraggablePerson
                                            key={person.id}
                                            person={person}
                                            deptId={g.id}
                                            canDrag={canEdit}
                                            onReorder={handleReorder}
                                        >
                                            <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-slate-800 truncate">
                                                            {person.full_name}
                                                        </span>
                                                        {person.rank_name && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {person.rank_name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                                                        {person.position && <span>{person.position}</span>}
                                                        {person.phone && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {person.phone}
                                                            </span>
                                                        )}
                                                        {person.unit_id && (
                                                            <span
                                                                className="inline-flex items-center gap-1"
                                                                title="Привязан к технике"
                                                            >
                                                                <Truck className="h-3 w-3" />
                                                                {person.unit_name || 'техника'}
                                                                {person.unit_plate_number
                                                                    ? ` · ${person.unit_plate_number}`
                                                                    : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {person.note && (
                                                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                                                            {person.note}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(person)}
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
                                                            onClick={() => {
                                                                setPersonToDelete(person);
                                                                setIsDeleteOpen(true);
                                                            }}
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                            title="Удалить"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </DraggablePerson>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DndProvider>
            )}

            <PersonnelForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setFormError('');
                        setSelectedPerson(null);
                    }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedPerson}
                isEdit={!!selectedPerson}
                isLoading={createPerson.isPending || updatePerson.isPending}
                error={formError}
                departments={departments}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление человека</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить «{personToDelete?.full_name || ''}» из личного состава? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deletePerson.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deletePerson.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );

};

export default PersonnelList;
