import { useState, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { usePermissions } from '../../hooks/usePermissions';
import {
    useAllGarrisons,
    useCreateGarrison,
    useUpdateGarrison,
    useDeleteGarrison,
    useReorderGarrisons,
} from '../../hooks/useGarrisons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
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
    Pencil,
    Trash2,
    GripVertical,
    Building,
    Info,
} from 'lucide-react';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

// Перетаскиваемая строка гарнизона
const DraggableGarrison = ({ garrison, onReorder, canDrag, children }) => {
    const [{ isDragging }, dragRef] = useDrag(
        () => ({
            type: 'GARRISON',
            item: { id: garrison.id },
            canDrag: () => !!canDrag,
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [garrison.id, canDrag]
    );

    const [, dropRef] = useDrop(
        () => ({
            accept: 'GARRISON',
            drop: (item) => {
                if (item.id !== garrison.id) onReorder(item.id, garrison.id);
            },
        }),
        [garrison.id, onReorder]
    );

    const ref = (node) => {
        dragRef(node);
        dropRef(node);
    };

    return (
        <tr
            ref={ref}
            className={`border-b border-slate-100 transition-colors ${
                isDragging ? 'opacity-40 bg-orange-50' : 'hover:bg-slate-50'
            }`}
        >
            {children}
        </tr>
    );
};

const GarrisonsList = () => {
    const { has } = usePermissions();
    const canUpdate = has('departments.update');

    const { data, isLoading, error } = useAllGarrisons();
    const createG = useCreateGarrison();
    const updateG = useUpdateGarrison();
    const deleteG = useDeleteGarrison();
    const reorderG = useReorderGarrisons();

    const [orderState, setOrderState] = useState({ sig: null, ids: null });
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formName, setFormName] = useState('');
    const [formError, setFormError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const raw = useMemo(() => asArray(data), [data]);

    // Отображаемый порядок: серверный по умолчанию, либо оптимистичный после перетаскивания.
    const rawSig = raw.map((i) => i.id).join('|');
    const effectiveIds = orderState.sig === rawSig ? orderState.ids : raw.map((i) => i.id);
    const items = (effectiveIds || [])
        .map((id) => raw.find((i) => i.id === id))
        .filter(Boolean);

    const openCreate = () => {
        setEditing(null);
        setFormName('');
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (g) => {
        setEditing(g);
        setFormName(g.name || '');
        setFormError('');
        setFormOpen(true);
    };

    const handleSave = () => {
        setFormError('');
        const name = formName.trim();
        if (!name) {
            setFormError('Укажите название гарнизона');
            return;
        }
        if (editing) {
            updateG.mutate(
                { id: editing.id, data: { name } },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: (err) =>
                        setFormError(err?.response?.data?.error || 'Ошибка обновления гарнизона'),
                }
            );
        } else {
            createG.mutate(
                { name },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: (err) =>
                        setFormError(err?.response?.data?.error || 'Ошибка создания гарнизона'),
                }
            );
        }
    };

    // Переместить draggedId на место targetId (оптимистично + сохранение)
    const handleReorder = (draggedId, targetId) => {
        const next = [...items];
        const from = next.findIndex((i) => i.id === draggedId);
        const to = next.findIndex((i) => i.id === targetId);
        if (from < 0 || to < 0) return;
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setOrderState({ sig: rawSig, ids: next.map((i) => i.id) });
        reorderG.mutate(next.map((i) => i.id));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Building className="h-6 w-6 text-orange-500" />
                            Гарнизоны
                        </h1>
                        <p className="text-sm text-slate-400">
                            Справочник гарнизонов. Гарнизон выбирается в подразделении. Порядок
                            меняется перетаскиванием.
                        </p>
                    </div>
                    {canUpdate && (
                        <Button
                            onClick={openCreate}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить гарнизон
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                        Ошибка загрузки гарнизонов
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        {canUpdate && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                                <Info className="h-3.5 w-3.5" />
                                Перетаскивайте строки за ручку, чтобы изменить порядок
                            </div>
                        )}
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    {canUpdate && <th className="w-10 px-4 py-2" />}
                                    <th className="text-left font-semibold text-slate-600 px-4 py-2">
                                        Гарнизон
                                    </th>
                                    {canUpdate && (
                                        <th className="w-20 text-right px-4 py-2">Действия</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={canUpdate ? 3 : 1}
                                            className="text-center text-slate-400 py-6"
                                        >
                                            Гарнизонов не добавлено
                                        </td>
                                    </tr>
                                )}
                                {items.map((g) => (
                                    <DraggableGarrison
                                        key={g.id}
                                        garrison={g}
                                        onReorder={handleReorder}
                                        canDrag={canUpdate}
                                    >
                                        {canUpdate && (
                                            <td className="px-4 py-2">
                                                <GripVertical
                                                    className="h-4 w-4 text-slate-300 cursor-grab"
                                                    title="Перетащить"
                                                />
                                            </td>
                                        )}
                                        <td className="px-4 py-2 font-medium">{g.name}</td>
                                        {canUpdate && (
                                            <td className="px-4 py-2 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(g)}
                                                    className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                                    title="Редактировать"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setToDelete(g)}
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                    title="Удалить гарнизон"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        )}
                                    </DraggableGarrison>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Удалить гарнизон</AlertDialogTitle>
                            <AlertDialogDescription>
                                Удалить гарнизон «{toDelete?.name}»? У подразделений, где он выбран,
                                гарнизон будет сброшен.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (toDelete) deleteG.mutate(toDelete.id);
                                    setToDelete(null);
                                }}
                                disabled={deleteG.isPending}
                                className="bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                                Удалить
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false); }}>
                    <DialogContent className="sm:max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg">
                                {editing ? 'Редактировать гарнизон' : 'Новый гарнизон'}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="g_name">Название гарнизона</Label>
                                <Input
                                    id="g_name"
                                    autoFocus
                                    placeholder="Например: Луганский гарнизон"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="rounded-lg"
                                />
                            </div>
                            {formError && <p className="text-xs text-red-600">{formError}</p>}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormOpen(false)}
                                className="rounded-lg"
                            >
                                Отмена
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={createG.isPending || updateG.isPending}
                                className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                {createG.isPending || updateG.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                {editing ? 'Сохранить' : 'Создать'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DndProvider>
    );
};

export default GarrisonsList;