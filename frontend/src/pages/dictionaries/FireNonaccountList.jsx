import { useState, useMemo } from 'react';
import {
    useFireNonaccountReasons,
    useCreateFireNonaccountReason,
    useUpdateFireNonaccountReason,
    useDeleteFireNonaccountReason,
} from '../../hooks/useDictionaries';
import { usePermissions } from '../../hooks/usePermissions';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Search, Edit, Trash2, Ban } from 'lucide-react';

const FireNonaccountList = () => {
    const { has } = usePermissions();
    const { data: items, isLoading, error } = useFireNonaccountReasons();
    const create = useCreateFireNonaccountReason();
    const update = useUpdateFireNonaccountReason();
    const del = useDeleteFireNonaccountReason();

    const canManage = has('dictionaries.manage');

    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [name, setName] = useState('');
    const [formError, setFormError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const filtered = useMemo(() => {
        const list = items || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter((x) => x.name.toLowerCase().includes(q));
    }, [items, search]);

    const openNew = () => {
        if (!canManage) return;
        setEditing('__new__');
        setName('');
        setFormError('');
    };
    const openEdit = (item) => {
        if (!canManage) return;
        setEditing(item.id);
        setName(item.name);
        setFormError('');
    };
    const handleSubmit = () => {
        setFormError('');
        const payload = { name: name.trim() };
        if (!payload.name) {
            setFormError('Укажите формулировку');
            return;
        }
        if (editing === '__new__') {
            create.mutate(payload, {
                onSuccess: () => setEditing(null),
                onError: (err) => setFormError(err.response?.data?.error || 'Ошибка создания'),
            });
        } else if (editing) {
            update.mutate({ id: editing, data: payload }, {
                onSuccess: () => setEditing(null),
                onError: (err) => setFormError(err.response?.data?.error || 'Ошибка обновления'),
            });
        }
    };
    const confirmDelete = () => {
        if (!toDelete) return;
        del.mutate(toDelete.id, {
            onSuccess: () => setToDelete(null),
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка удаления');
                setToDelete(null);
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
        return <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">Ошибка загрузки справочника</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Ban className="h-6 w-6 text-red-500" />
                    <h1 className="text-2xl font-bold text-slate-800">Пожар не подлежит учёту — причины</h1>
                </div>
                {canManage && (
                    <Button onClick={openNew} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                        <Plus className="h-4 w-4 mr-2" /> Добавить
                    </Button>
                )}
            </div>

            <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..." className="rounded-lg pl-10" />
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Формулировка</TableHead>
                        {canManage && <TableHead className="w-24" />}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={canManage ? 2 : 1} className="text-center text-slate-400">Пусто</TableCell></TableRow>
                    )}
                    {filtered.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="whitespace-pre-wrap break-words align-top">
                                {item.name}
                            </TableCell>
                            {canManage && (
                                <TableCell className="text-right align-top">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="h-8 w-8 p-0" title="Редактировать">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setToDelete(item)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700" title="Удалить">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {editing && (
                <div className="rounded-xl border border-slate-200 p-4">
                    <h2 className="text-base font-semibold text-slate-700 mb-3">{editing === '__new__' ? 'Новая причина' : 'Редактирование'}</h2>
                    <div className="space-y-2">
                        <Label htmlFor="na-name">Формулировка</Label>
                        <Input id="na-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg" />
                    </div>
                    {formError && <p className="text-sm text-red-600 mt-2">{formError}</p>}
                    <div className="flex gap-2 mt-3">
                        <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending || update.isPending} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            {create.isPending || update.isPending ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                        <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Отмена</Button>
                    </div>
                </div>
            )}

            <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить?</AlertDialogTitle>
                        <AlertDialogDescription>Причина будет удалена навсегда. Это действие нельзя отменить.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={del.isPending} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            {del.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FireNonaccountList;