import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Truck } from 'lucide-react';

const statusOptions = [
    { value: 'available', label: 'Доступна' },
    { value: 'dispatched', label: 'На вызове' },
    { value: 'repair', label: 'В ремонте' },
    { value: 'unavailable', label: 'Недоступна' },
];

const UnitForm = ({ open, onOpenChange, onSubmit, initialData, isLoading, departments }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        plate_number: '',
        status: 'available',
        department_id: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                type: initialData.type || '',
                plate_number: initialData.plate_number || '',
                status: initialData.status || 'available',
                department_id: initialData.department_id || '',
            });
        } else {
            setFormData({
                name: '',
                type: '',
                plate_number: '',
                status: 'available',
                department_id: '',
            });
        }
    }, [initialData, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const isEdit = !!initialData;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать технику' : 'Новая техника'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Название</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Введите название техники"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Тип</Label>
                            <Input
                                id="type"
                                name="type"
                                placeholder="Тип техники (например, пожарная машина)"
                                value={formData.type}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="plate_number">Госномер</Label>
                            <Input
                                id="plate_number"
                                name="plate_number"
                                placeholder="Государственный номер"
                                value={formData.plate_number}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Статус</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) => handleSelectChange('status', value)}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Выберите статус" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department_id">Подразделение</Label>
                            <Select
                                value={formData.department_id}
                                onValueChange={(value) => handleSelectChange('department_id', value)}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Выберите подразделение" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments?.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {isLoading ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default UnitForm;