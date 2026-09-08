import { useState, useMemo } from 'react';
import { useFires, useDeleteFire } from '../../hooks/useFires';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { Loader2, Plus, Search, Edit, Trash2 } from 'lucide-react';
import FireForm from '../../components/FireForm';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusColors = {
    active: 'bg-red-500',
    resolved: 'bg-green-500',
    closed: 'bg-gray-500',
};

const statusLabels = {
    active: 'Активный',
    resolved: 'Решён',
    closed: 'Закрыт',
};

const FiresList = () => {
    const { data, isLoading, error } = useFires();
    const deleteFire = useDeleteFire();

    // Состояния фильтров
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Состояния для модалок
    const [selectedFire, setSelectedFire] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [fireToDelete, setFireToDelete] = useState(null);

    const fires = data?.data || [];

    // Фильтрация
    const filteredFires = useMemo(() => {
        return fires.filter((fire) => {
            const matchesSearch = fire.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                fire.address?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || fire.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [fires, searchTerm, statusFilter]);

    const handleCreate = () => {
        setSelectedFire(null);
        setIsFormOpen(true);
    };

    const handleEdit = (fire) => {
        setSelectedFire(fire);
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setFireToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (fireToDelete) {
            deleteFire.mutate(fireToDelete);
            setFireToDelete(null);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleFormSubmit = (data) => {
        console.log('Submit:', data);
        setIsFormOpen(false);
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
                Ошибка загрузки пожаров
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Заголовок и кнопка создания */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Пожары</h2>
                    <p className="text-sm text-slate-500">Всего: {filteredFires.length}</p>
                </div>
                <Button
                    onClick={handleCreate}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Новый пожар
                </Button>
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по названию или адресу..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] rounded-lg">
                        <SelectValue placeholder="Все статусы" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        <SelectItem value="active">Активный</SelectItem>
                        <SelectItem value="resolved">Решён</SelectItem>
                        <SelectItem value="closed">Закрыт</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Таблица */}
            {filteredFires.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <p>Нет пожаров, соответствующих фильтрам</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Адрес</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Подразделение</TableHead>
                                <TableHead>Создан</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredFires.map((fire) => (
                                <TableRow key={fire.id}>
                                    <TableCell className="font-medium">{fire.title}</TableCell>
                                    <TableCell>{fire.address || '—'}</TableCell>
                                    <TableCell>
                                        <Badge className={`${statusColors[fire.status] || 'bg-gray-500'} text-white`}>
                                            {statusLabels[fire.status] || fire.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{fire.department_name || '—'}</TableCell>
                                    <TableCell>
                                        {fire.created_at ? format(new Date(fire.created_at), 'dd.MM.yyyy HH:mm', { locale: ru }) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(fire)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(fire.id)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Модалки */}
            <FireForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                initialData={selectedFire}
                isLoading={false}
                departments={[]}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление пожара</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы уверены, что хотите удалить этот пожар? Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
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

export default FiresList;