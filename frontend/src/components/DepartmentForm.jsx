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
import { Building2 } from 'lucide-react';

const DepartmentForm = ({
                            open,
                            onOpenChange,
                            onSubmit,
                            initialData,
                            isLoading,
                            error,
                            departments,
                        }) => {
    const [formData, setFormData] = useState({
        name: '',
        parent_id: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                parent_id: initialData.parent_id || '',
            });
        } else {
            setFormData({
                name: '',
                parent_id: '',
            });
        }
    }, [initialData, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Преобразуем пустую строку parent_id в null
        const payload = {
            ...formData,
            parent_id: formData.parent_id === '' ? null : formData.parent_id,
        };
        onSubmit(payload);
    };

    const isEdit = !!initialData;

    // Исключаем из списка родительских подразделений самого себя (чтобы нельзя было сделать себя родителем)
    const availableParents = departments?.filter((d) => d.id !== initialData?.id) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать подразделение' : 'Новое подразделение'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Название</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Введите название подразделения"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parent_id">Родительское подразделение</Label>
                            <Select
                                value={formData.parent_id || 'none'}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        parent_id: value === 'none' ? '' : value,
                                    }))
                                }
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Нет (корневое)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Нет (корневое)</SelectItem>
                                    {availableParents.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}
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

export default DepartmentForm;