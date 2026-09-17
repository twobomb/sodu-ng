import { useState, useMemo } from 'react';
import {
    useFireCategories,
    useCreateFireCategory,
    useUpdateFireCategory,
    useDeleteFireCategory,
} from '../../hooks/useDictionaries';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
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
import { Loader2, Plus, Edit, Trash2, FolderTree } from 'lucide-react';

const FireCategoriesList = () => {
    const { has } = usePermissions();
    const { data: items, isLoading, error } = useFireCategories();
    const create = useCreateFireCategory();
    const update = useUpdateFireCategory();
    const del = useDeleteFireCategory();

    const canManage = has('dictionaries.manage');

    const [editing, setEditing] = useState(null); // null | '__new__' | id
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [code, setCode] = useState('');
    const [formError, setFormError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const cats = items || [];

    // Построение дерева: parentId -> [children]
    const byParent = useMemo(() => {
        const m = {};
        for (const c of cats) {
            const pid = c.parent_id || '__ROOT__';
            if (!m[pid]) m[pid] = [];
            m[pid].push(c);
        }
        for (const k in m) m[k].sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name), 'ru'));
        return m;
    }, [cats]);

    const renderNode = (node, depth) => (
        <div key={node.id}>
            <div
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                style={{ paddingLeft: 8 + depth * 20 }}
            >
                <span className="text-sm text-slate-700">
                    {node.code ? <span className="text-slate-400 font-medium mr-1">{node.code}</span> : null}
                    {node.name}
                </span>
                {canManage && (
                    <span className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openNew(node)} className="h-7 w-7 p-0" title="Добавить подкатегорию">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(node)} className="h-7 w-7 p-0" title="Редактировать">
                            <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setToDelete(node)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Удалить">
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </span>
                )}
            </div>
            {(byParent[node.id] || []).map((child) => renderNode(child, depth + 1))}
        </div>
    );

    const openNew = (parent = null) => {
        if (!canManage) return;
        setEditing('__new__');
        setName('');
        setCode('');
        setParentId(parent ? parent.id : '');
        setFormError('');
    };
    const openEdit = (node) => {
        if (!canManage) return;
        setEditing(node.id);
        setName(node.name);
        setCode(node.code || '');
        setParentId(node.parent_id || '');
        setFormError('');
    };

    const handleSubmit = () => {
        setFormError('');
        const payload = { name: name.trim(), code: code.trim(), parent_id: parentId || null };
        if (!payload.name) {
            setFormError('Укажите название');
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

    const roots = byParent['__ROOT__'] || [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <FolderTree className="h-6 w-6 text-orange-500" />
                    <h1 className="text-2xl font-bold text-slate-800">Категории пожаров</h1>
                </div>
                {canManage && (
                    <Button onClick={() => openNew(null)} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                        <Plus className="h-4 w-4 mr-2" /> Добавить категорию
                    </Button>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
                {roots.length === 0 && <p className="text-sm text-slate-400">Категорий пока нет</p>}
                {roots.map((root) => renderNode(root, 0))}
            </div>

            {editing && (
                <Dialog open={true} onOpenChange={(o) => { if (!o) { setEditing(null); setFormError(''); } }}>
                    <DialogContent className="sm:max-w-lg rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{editing === '__new__' ? 'Новая категория' : 'Редактирование категории'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-3 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="cat-name">Название</Label>
                                <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cat-code">Код (необязательно)</Label>
                                <Input id="cat-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1.1.1" className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cat-parent">Родитель</Label>
                                <NativeSelect value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
                                    <NativeSelectOption value="">Корневая категория</NativeSelectOption>
                                    {cats.map((c) => (
                                        <NativeSelectOption key={c.id} value={c.id}>
                                            {c.code ? c.code + ' ' : ''}{c.name}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                        </div>
                        {formError && <p className="text-sm text-red-600 mt-2">{formError}</p>}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setEditing(null); setFormError(''); }} className="rounded-lg">Отмена</Button>
                            <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending || update.isPending} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                                {create.isPending || update.isPending ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
                        <AlertDialogDescription>Категория «{toDelete?.name}» будет удалена навсегда. Это действие нельзя отменить.</AlertDialogDescription>
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

export default FireCategoriesList;