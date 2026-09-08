import { useState, useMemo } from 'react';
import { useUnits, useDeleteUnit } from '../../hooks/useUnits';
import { useDepartments } from '../../hooks/useDepartments';
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
import UnitForm from '../../components/UnitForm';

const statusColors = {
    available: 'bg-green-500',
    dispatched: 'bg-orange-500',
    repair: 'bg-yellow-500',
    unavailable: 'bg-red-500',
};

const statusLabels = {
    available: 'Доступна',
    dispatched: 'На вызове',
    repair: 'В ремонте',
    unavailable: 'Недоступна',
};

const UnitsList = () => {
    const { data, isLoading, error } = useUnits();
    const { data: deptData, isLoading: deptsLoading } = useDepartments();
    const deleteUnit = useDeleteUnit();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);

    const units = data?.data || [];
    const departments = deptData?.data || [];

    const filteredUnits = useMemo(() => {
        return units.filter((unit) => {
            const matchesSearch = unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                unit.plate_number?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [units, searchTerm, statusFilter]);

    const handleCreate = () => {
        setSelectedUnit(null);
        setIsFormOpen(true);
    };

    const handleEdit = (unit) => {
        setSelectedUnit(unit);
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setUnitToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (unitToDelete) {
            deleteUnit.mutate(unitToDelete);
            setUnitToDelete(null);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleFormSubmit = (data) => {
        console.log('Submit unit:', data);
        setIsFormOpen(false);
    };

    if (isLoading || deptsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки техники
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Техника</h2>
                    <p className="text-sm text-slate-500">Всего: {filteredUnits.length}</p>
                </div>
                <Button
                    onClick={handleCreate}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Новая техника
                </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по названию или госномеру..."
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
                        <SelectItem value="available">Доступна</SelectItem>
                        <SelectItem value="dispatched">На вызове</SelectItem>
                        <SelectItem value="repair">В ремонте</SelectItem>
                        <SelectItem value="unavailable">Недоступна</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filteredUnits.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <p>Нет техники, соответствующей фильтрам</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead>Госномер</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Подразделение</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUnits.map((unit) => (
                                <TableRow key={unit.id}>
                                    <TableCell className="font-medium">{unit.name}</TableCell>
                                    <TableCell>{unit.type || '—'}</TableCell>
                                    <TableCell>{unit.plate_number || '—'}</TableCell>
                                    <TableCell>
                                        <Badge className={`${statusColors[unit.status] || 'bg-gray-500'} text-white`}>
                                            {statusLabels[unit.status] || unit.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{unit.department_name || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(unit)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(unit.id)}
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

            <UnitForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                initialData={selectedUnit}
                isLoading={false}
                departments={departments}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление техники</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы уверены, что хотите удалить эту технику? Это действие нельзя отменить.
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

export default UnitsList;