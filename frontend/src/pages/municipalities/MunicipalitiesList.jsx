import { useState, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { usePermissions } from '../../hooks/usePermissions';
import {
    useAllMunicipalities,
    useCreateMunicipality,
    useUpdateMunicipality,
    useDeleteMunicipality,
    useReorderMunicipalities,
} from '../../hooks/useMunicipalities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Plus, Pencil, Trash2, MapPin, GripVertical, Info } from 'lucide-react';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

// Перетаскиваемая строка округа
const DraggableMunicipality = ({ m, onReorder, canDrag, children }) => {
    const [{ isDragging }, dragRef] = useDrag(
        () => ({
            type: 'MUNICIPALITY',
            item: { id: m.id },
            canDrag: () => !!canDrag,
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [m.id, canDrag]
    );

    const [, dropRef] = useDrop(
        () => ({
            accept: 'MUNICIPALITY',
            drop: (item) => {
                if (item.id !== m.id) onReorder(item.id, m.id);
            },
        }),
        [m.id, onReorder]
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

const MunicipalitiesList = () => {
    const { has } = usePermissions();
    const canUpdate = has('departments.update');

    const { data, isLoading, error } = useAllMunicipalities();

    const createM = useCreateMunicipality();
    const updateM = useUpdateMunicipality();
    const deleteM = useDeleteMunicipality();
    const reorderM = useReorderMunicipalities();

    const [orderState, setOrderState] = useState({ sig: null, ids: null });
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null); // округ на редактирование
    const [formName, setFormName] = useState('');
    const [formError, setFormError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const list = useMemo(() => asArray(data), [data]);

    // Отображаемый порядок: серверный по умолчанию, либо оптимистичный после перетаскивания.
    const listSig = list.map((i) => i.id).join('|');
    const effectiveIds = orderState.sig === listSig ? orderState.ids : list.map((i) => i.id);
    const items = (effectiveIds || [])
        .map((id) => list.find((i) => i.id === id))
        .filter(Boolean);

    const openCreate = () => {
        setEditing(null);
        setFormName('');
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (m) => {
        setEditing(m);
        setFormName(m.name || '');
        setFormError('');
        setFormOpen(true);
    };

    const handleSave = () => {
        setFormError('');
        const name = formName.trim();
        if (!name) {
            setFormError('Укажите название округа');
            return;
        }
        if (editing) {
            updateM.mutate(
                { id: editing.id, data: { name } },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: (err) =>
                        setFormError(err?.response?.data?.error || 'Ошибка обновления округа'),
                }
            );
        } else {
            createM.mutate(
                { name },
                { onSuccess: () => setFormOpen(false), onError: (err) =>
                    setFormError(err?.response?.data?.error || 'Ошибка создания округа') }
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
        setOrderState({ sig: listSig, ids: next.map((i) => i.id) });
        reorderM.mutate(next.map((i) => i.id));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-orange-500" />
                        Округа
                    </h1>
                    <p className="text-sm text-slate-400">
                        Справочник округов. Округ выбирается в подразделении и используется при оформлении вызовов
                    </p>
                </div>
                {canUpdate && (
                    <Button
                        onClick={openCreate}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить округ
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    Ошибка загрузки округов
                </div>
            ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    {canUpdate && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                            <Info className="h-3.5 w-3.5" />
                            Перетаскивайте строки за ручку, чтобы изменить порядок
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {canUpdate && <TableHead className="w-10" />}
                                <TableHead>Округ</TableHead>
                                {canUpdate && <TableHead className="w-16">Действия</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={canUpdate ? 3 : 1}
                                        className="text-center text-slate-400 py-6"
                                    >
                                        Округов не добавлено
                                    </TableCell>
                                </TableRow>
                            )}
                            {items.map((m) => (
                                <DraggableMunicipality
                                    key={m.id}
                                    m={m}
                                    onReorder={handleReorder}
                                    canDrag={canUpdate}
                                >
                                    {canUpdate && (
                                        <TableCell>
                                            <GripVertical
                                                className="h-4 w-4 text-slate-300 cursor-grab"
                                                title="Перетащить"
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium">{m.name}</TableCell>
                                    {canUpdate && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(m)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                                title="Редактировать округ"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setToDelete(m)}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                title="Удалить округ"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </DraggableMunicipality>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить округ</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить округ «{toDelete?.name}»?
                            У подразделений, где он выбран, округ будет сброшен.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (toDelete) deleteM.mutate(toDelete.id);
                                setToDelete(null);
                            }}
                            disabled={deleteM.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Создание / редактирование округа */}
            <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false); }}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            {editing ? 'Редактировать округ' : 'Новый округ'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="muni_name">Название округа</Label>
                            <Input
                                id="muni_name"
                                autoFocus
                                placeholder="Например: городской округ город Кировск"
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
                            disabled={createM.isPending || updateM.isPending}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {createM.isPending || updateM.isPending ? (
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

export default MunicipalitiesList;