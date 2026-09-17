import { useState, useMemo } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAllMunicipalities, useCreateMunicipality, useDeleteMunicipality } from '../../hooks/useMunicipalities';
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
import { Loader2, Plus, Trash2, MapPin } from 'lucide-react';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

const MunicipalitiesList = () => {
    const { has } = usePermissions();
    const canUpdate = has('departments.update');

    const { data, isLoading, error } = useAllMunicipalities();

    const createM = useCreateMunicipality();
    const deleteM = useDeleteMunicipality();

    const [name, setName] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const list = useMemo(() => asArray(data), [data]);

    const handleCreate = () => {
        if (!name.trim() || createM.isPending) return;
        createM.mutate({ name: name.trim() }, { onSuccess: () => setName('') });
    };

    return (
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
            </div>

            {canUpdate && (
                <div className="rounded-xl border border-slate-200 p-4">
                    <h2 className="text-base font-semibold text-slate-700 mb-3">Добавить округ</h2>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="muni_name">Название округа</Label>
                            <Input
                                id="muni_name"
                                placeholder="Например: городской округ город Кировск"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="h-6" />
                            <Button
                                onClick={handleCreate}
                                disabled={createM.isPending || !name.trim()}
                                className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                {createM.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                Добавить
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Округ</TableHead>
                                {canUpdate && <TableHead className="w-16">Действия</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {list.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={canUpdate ? 2 : 1}
                                        className="text-center text-slate-400 py-6"
                                    >
                                        Округов не добавлено
                                    </TableCell>
                                </TableRow>
                            )}
                            {list.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell className="font-medium">{m.name}</TableCell>
                                    {canUpdate && (
                                        <TableCell className="text-right">
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
                                </TableRow>
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
        </div>
    );
};

export default MunicipalitiesList;