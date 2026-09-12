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
import { Truck, Loader2 } from 'lucide-react';

const UnitTypeForm = ({
                          open,
                          onOpenChange,
                          onSubmit,
                          initialData,
                          isLoading,
                          error,
                      }) => {
    const [formData, setFormData] = useState({
        name: '',
        short_name: '',
        sort_order: '',
    });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                short_name: initialData.short_name || '',
                sort_order: initialData.sort_order ?? '',
            });
        } else {
            setFormData({ name: '', short_name: '', sort_order: '' });
        }
        setLocalError('');
    }, [initialData, open]);

    const isEdit = !!initialData;

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');

        if (!formData.name.trim()) {
            setLocalError('Укажите полное название');
            return;
        }
        if (!formData.short_name.trim()) {
            setLocalError('Укажите сокращённое название');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            short_name: formData.short_name.trim(),
        };

        if (formData.sort_order !== '' && formData.sort_order !== null) {
            payload.sort_order = Number(formData.sort_order);
        }

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Truck className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать тип' : 'Новый тип техники'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Полное название</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, name: e.target.value }))
                                }
                                placeholder="Например, Автолестница"
                                required
                                autoFocus
                                className="rounded-lg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="short_name">Сокращённое</Label>
                            <Input
                                id="short_name"
                                value={formData.short_name}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, short_name: e.target.value }))
                                }
                                placeholder="Например, АЛ"
                                required
                                maxLength={50}
                                className="rounded-lg"
                            />
                            <p className="text-xs text-slate-400">
                                Отображается в сетке техники
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sort_order">Порядок сортировки</Label>
                            <Input
                                id="sort_order"
                                type="number"
                                value={formData.sort_order}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, sort_order: e.target.value }))
                                }
                                placeholder="Оставьте пустым для авто"
                                className="rounded-lg"
                            />
                        </div>

                        {(localError || error) && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                                {localError || error}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg"
                            disabled={isLoading}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : isEdit ? (
                                'Сохранить'
                            ) : (
                                'Создать'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default UnitTypeForm;