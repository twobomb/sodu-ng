import { useState, useMemo } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
    useAllDepartmentTypes,
    useCreateDepartmentType,
    useUpdateDepartmentType,
    useDeleteDepartmentType,
} from '../../hooks/useDepartmentTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

const DepartmentTypesList = () => {
    const { has } = usePermissions();
    const canUpdate = has('departments.update');

    const { data, isLoading, error } = useAllDepartmentTypes();
    const createT = useCreateDepartmentType();
    const updateT = useUpdateDepartmentType();
    const deleteT = useDeleteDepartmentType();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formName, setFormName] = useState('');
    const [formError, setFormError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const list = useMemo(() => asArray(data), [data]);

    const openCreate = () => {
        setEditing(null);
        setFormName('');
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (t) => {
        setEditing(t);
        setFormName(t.name || '');
        setFormError('');
        setFormOpen(true);
    };

    const handleSave = () => {
        setFormError('');
        const name = formName.trim();
        if (!name) {
            setFormError('Укажите название вида подразделения');
            return;
        }
        if (editing) {
            updateT.mutate(
                { id: editing.id, data: { name } },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: (err) =>
                        setFormError(
                            err?.response?.data?.error ||
                                'Ошибка обновления вида подразделения'
                        ),
                }
            );
        } else {
            createT.mutate(
                { name },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: (err) =>
                        setFormError(
                            err?.response?.data?.error ||
                                'Ошибка создания вида подразделения'
                        ),
                }
            );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-orange-500" />
                        Виды подразделений
                    </h1>
                    <p className="text-sm text-slate-400">
                        Справочник видов подразделений. Вид выбирается в подразделении.
                        Системные виды (ФПС, ППС, ВПО, ЧПО, МПО, ДПК, АСФ) удалить нельзя.
                    </p>
                </div>
                {canUpdate && (
                    <Button
                        onClick={openCreate}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить вид
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    Ошибка загрузки видов подразделений
                </div>
            ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Вид подразделения</TableHead>
                                <TableHead className="w-24">Тип</TableHead>
                                {canUpdate && <TableHead className="w-16">Действия</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {list.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={canUpdate ? 3 : 2}
                                        className="text-center text-slate-400 py-6"
                                    >
                                        Видов подразделений не добавлено
                                    </TableCell>
                                </TableRow>
                            )}
                            {list.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.name}</TableCell>
                                    <TableCell>
                                        {t.is_system ? (
                                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
                                                Системный
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-orange-50 text-orange-600 hover:bg-orange-50">
                                                Пользовательский
                                            </Badge>
                                        )}
                                    </TableCell>
                                    {canUpdate && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(t)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                                title="Редактировать"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {t.is_system ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled
                                                    className="h-8 w-8 p-0 text-slate-300"
                                                    title="Системный вид нельзя удалить"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setToDelete(t)}
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить вид подразделения</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить вид подразделения «{toDelete?.name}»? У подразделений,
                            где он выбран, вид будет сброшен.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (toDelete) deleteT.mutate(toDelete.id);
                                setToDelete(null);
                            }}
                            disabled={deleteT.isPending}
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
                            {editing ? 'Редактировать вид подразделения' : 'Новый вид подразделения'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="dt_name">Название вида</Label>
                            <Input
                                id="dt_name"
                                autoFocus
                                placeholder="Например: ФПС"
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
                            disabled={createT.isPending || updateT.isPending}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {createT.isPending || updateT.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            {editing ? 'Сохранить' : 'Создать'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DepartmentTypesList;