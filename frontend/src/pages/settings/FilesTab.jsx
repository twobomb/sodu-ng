import { useState, useMemo } from 'react';
import {
    useAdminFiles,
    useFolderSize,
    useDeleteAdminFiles,
} from '../../hooks/useSettings';
import { Button } from '@/components/ui/button';
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
    HardDrive,
    RefreshCw,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Форматирование размера
const formatSize = (bytes) => {
    if (!bytes || bytes < 0) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
};

const FilesTab = () => {
    const { data: files = [], isLoading, refetch, isFetching } = useAdminFiles();
    const { data: folderSize, refetch: refetchSize } = useFolderSize();
    const deleteFiles = useDeleteAdminFiles();

    const [selected, setSelected] = useState(new Set());
    const [sortKey, setSortKey] = useState('fs_created_at');
    const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'orphans' | 'attached'

    // Сортировка + фильтр
    const displayFiles = useMemo(() => {
        let result = [...files];

        if (filter === 'orphans') result = result.filter((f) => f.is_orphan);
        if (filter === 'attached') result = result.filter((f) => !f.is_orphan && !f.is_thumbnail);

        result.sort((a, b) => {
            let aVal = a[sortKey];
            let bVal = b[sortKey];
            if (sortKey === 'fs_created_at' || sortKey === 'db_created_at') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }
            if (typeof aVal === 'string') {
                return sortDir === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return result;
    }, [files, sortKey, sortDir, filter]);

    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ column }) => {
        if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
        return sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-orange-500" />
        ) : (
            <ArrowDown className="h-3 w-3 text-orange-500" />
        );
    };

    const toggleOne = (name) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === displayFiles.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(displayFiles.map((f) => f.stored_name)));
        }
    };

    const handleDelete = () => {
        const names = Array.from(selected);
        deleteFiles.mutate(names, {
            onSuccess: (data) => {
                setSelected(new Set());
                setConfirmDelete(false);
                // Обновляем папку
                setTimeout(() => {
                    refetch();
                    refetchSize();
                }, 300);
            },
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка удаления');
            },
        });
    };

    const selectedSize = useMemo(() => {
        let total = 0;
        for (const f of files) {
            if (selected.has(f.stored_name)) total += f.size;
        }
        return total;
    }, [files, selected]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Панель с весом папки */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <HardDrive className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Всего в uploads</div>
                        <div className="text-lg font-bold text-slate-800">
                            {folderSize ? formatSize(folderSize.total_bytes) : '—'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                    <div>
                        <div className="text-xs text-slate-500">Файлов</div>
                        <div className="text-sm font-semibold text-slate-700">
                            {folderSize?.files_count ?? '—'}
                        </div>
                    </div>
                </div>

                {folderSize?.orphans_count > 0 && (
                    <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                        <div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                                «Сироты» (без привязки)
                            </div>
                            <div className="text-sm font-semibold text-amber-600">
                                {formatSize(folderSize.orphans_bytes)} ·{' '}
                                {folderSize.orphans_count} шт.
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchSize()}
                    className="ml-auto h-9 rounded-lg gap-1.5"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Обновить вес
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="h-9 rounded-lg gap-1.5"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    Обновить список
                </Button>
            </div>

            {/* Панель действий */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className={`h-9 rounded-lg ${filter === 'all' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    >
                        Все ({files.length})
                    </Button>
                    <Button
                        variant={filter === 'attached' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('attached')}
                        className={`h-9 rounded-lg ${filter === 'attached' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    >
                        Привязанные
                    </Button>
                    <Button
                        variant={filter === 'orphans' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('orphans')}
                        className={`h-9 rounded-lg ${filter === 'orphans' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    >
                        Сироты ({files.filter((f) => f.is_orphan).length})
                    </Button>
                </div>

                {selected.size > 0 && (
                    <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-slate-600">
              Выбрано: <strong>{selected.size}</strong> · {formatSize(selectedSize)}
            </span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmDelete(true)}
                            className="h-9 rounded-lg gap-1.5"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Удалить выбранные
                        </Button>
                    </div>
                )}
            </div>

            {/* Таблица */}
            {displayFiles.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <HardDrive className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Файлов нет</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        checked={
                                            selected.size === displayFiles.length &&
                                            displayFiles.length > 0
                                        }
                                        onChange={toggleAll}
                                        className="h-4 w-4 rounded accent-orange-500"
                                    />
                                </TableHead>
                                <TableHead>Файл</TableHead>
                                <TableHead>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('size')}
                                        className="flex items-center gap-1.5 hover:text-slate-800"
                                    >
                                        Размер
                                        <SortIcon column="size" />
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('fs_created_at')}
                                        className="flex items-center gap-1.5 hover:text-slate-800"
                                    >
                                        Дата загрузки
                                        <SortIcon column="fs_created_at" />
                                    </button>
                                </TableHead>
                                <TableHead>Статус</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayFiles.map((f) => {
                                const isSelected = selected.has(f.stored_name);
                                const dateRaw = f.db_created_at || f.fs_created_at;
                                return (
                                    <TableRow
                                        key={f.stored_name}
                                        className={isSelected ? 'bg-orange-50' : ''}
                                    >
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleOne(f.stored_name)}
                                                className="h-4 w-4 rounded accent-orange-500"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-800 truncate max-w-[400px]">
                                                    {f.original_name || f.stored_name}
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                                    {f.stored_name}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap font-mono text-sm">
                                            {formatSize(f.size)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                            {dateRaw
                                                ? format(new Date(dateRaw), 'dd.MM.yyyy HH:mm', {
                                                    locale: ru,
                                                })
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {f.is_thumbnail ? (
                                                <Badge variant="outline" className="text-xs text-slate-500">
                                                    миниатюра
                                                </Badge>
                                            ) : f.is_orphan ? (
                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                                    сирота
                                                </Badge>
                                            ) : f.is_missing ? (
                                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                                    помечен missing
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                                    активен
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Подтверждение удаления */}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить файлы?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Будет удалено <strong>{selected.size}</strong> файлов
                            ({formatSize(selectedSize)}). Файлы исчезнут с диска, а связанные
                            сообщения в чате перестанут открываться. Это действие нельзя
                            отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteFiles.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteFiles.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FilesTab;