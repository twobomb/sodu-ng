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
import { Flame } from 'lucide-react';

const statusOptions = [
    { value: 'active', label: 'Активный' },
    { value: 'resolved', label: 'Решён' },
    { value: 'closed', label: 'Закрыт' },
];

const FireForm = ({ open, onOpenChange, onSubmit, initialData, isLoading, departments }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        address: '',
        lat: '',
        lng: '',
        status: 'active',
        department_id: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || '',
                description: initialData.description || '',
                address: initialData.address || '',
                lat: initialData.lat || '',
                lng: initialData.lng || '',
                status: initialData.status || 'active',
                department_id: initialData.department_id || '',
            });
        } else {
            setFormData({
                title: '',
                description: '',
                address: '',
                lat: '',
                lng: '',
                status: 'active',
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
                        <Flame className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать пожар' : 'Новый пожар'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Название</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="Введите название пожара"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Описание</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Описание пожара"
                                value={formData.description}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес</Label>
                            <Input
                                id="address"
                                name="address"
                                placeholder="Адрес пожара"
                                value={formData.address}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lat">Широта</Label>
                                <Input
                                    id="lat"
                                    name="lat"
                                    placeholder="55.7558"
                                    value={formData.lat}
                                    onChange={handleChange}
                                    className="rounded-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lng">Долгота</Label>
                                <Input
                                    id="lng"
                                    name="lng"
                                    placeholder="37.6173"
                                    value={formData.lng}
                                    onChange={handleChange}
                                    className="rounded-lg"
                                />
                            </div>
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

export default FireForm;