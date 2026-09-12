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
import { Loader2, Palette } from 'lucide-react';

// Предустановленные цвета — на случай, если пользователь захочет быстрый выбор
const PRESET_COLORS = [
    { hex: '#16a34a', name: 'Зелёный' },
    { hex: '#a3a334', name: 'Хаки' },
    { hex: '#8b4513', name: 'Бурый' },
    { hex: '#dc2626', name: 'Красный' },
    { hex: '#2563eb', name: 'Синий' },
    { hex: '#c2410c', name: 'Тёмно-оранжевый' },
    { hex: '#7c3aed', name: 'Фиолетовый' },
    { hex: '#0891b2', name: 'Голубой' },
    { hex: '#6b7280', name: 'Серый' },
    { hex: '#000000', name: 'Чёрный' },
];

const UnitStatusForm = ({
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
        color: '#16a34a',
        color_name: '',
        sort_order: '',
    });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                short_name: initialData.short_name || '',
                color: initialData.color || '#16a34a',
                color_name: initialData.color_name || '',
                sort_order: initialData.sort_order ?? '',
            });
        } else {
            setFormData({
                name: '',
                short_name: '',
                color: '#16a34a',
                color_name: '',
                sort_order: '',
            });
        }
        setLocalError('');
    }, [initialData, open]);

    const isEdit = !!initialData;
    const isSystem = initialData?.is_system;

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
        if (!/^#[0-9a-fA-F]{6}$/.test(formData.color)) {
            setLocalError('Цвет должен быть в формате #RRGGBB');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            short_name: formData.short_name.trim(),
            color: formData.color,
            color_name: formData.color_name.trim() || null,
        };

        if (formData.sort_order !== '' && formData.sort_order !== null) {
            payload.sort_order = Number(formData.sort_order);
        }

        onSubmit(payload);
    };

    const handlePreset = (preset) => {
        setFormData((p) => ({
            ...p,
            color: preset.hex,
            color_name: preset.name,
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Palette className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать статус' : 'Новый статус'}
                        {isSystem && (
                            <span className="text-xs text-slate-400 font-normal">
                (системный)
              </span>
                        )}
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
                                placeholder="В боевом расчёте"
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
                                placeholder="В расчете"
                                required
                                maxLength={50}
                                className="rounded-lg"
                            />
                            <p className="text-xs text-slate-400">
                                Отображается в ячейке на странице «Вся техника»
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Цвет</Label>
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-lg border-2 border-slate-200 flex-shrink-0"
                                    style={{ backgroundColor: formData.color }}
                                />
                                <Input
                                    value={formData.color}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, color: e.target.value }))
                                    }
                                    placeholder="#16a34a"
                                    className="rounded-lg font-mono"
                                />
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {PRESET_COLORS.map((preset) => (
                                    <button
                                        key={preset.hex}
                                        type="button"
                                        title={preset.name}
                                        onClick={() => handlePreset(preset)}
                                        className={`h-7 w-7 rounded-md border-2 transition-all hover:scale-110 ${
                                            formData.color === preset.hex
                                                ? 'border-slate-800'
                                                : 'border-slate-200'
                                        }`}
                                        style={{ backgroundColor: preset.hex }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="color_name">Название цвета</Label>
                            <Input
                                id="color_name"
                                value={formData.color_name}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, color_name: e.target.value }))
                                }
                                placeholder="Зелёный"
                                className="rounded-lg"
                            />
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
                            <p className="text-xs text-slate-400">
                                Статусы с меньшим числом идут выше в списках
                            </p>
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

export default UnitStatusForm;