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
import { Truck, Loader2 } from 'lucide-react';
import { useUnitTypes, useUnitStatuses } from '../hooks/useUnits';

// ============================================================
// Нормализация: массив / {data: [...]} / undefined → массив
// ============================================================
const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

const UnitForm = ({
                      open,
                      onOpenChange,
                      onSubmit,
                      initialData,
                      isLoading,
                      departments,
                      isEdit = false,
                  }) => {
    const { data: typesRaw } = useUnitTypes();
    const { data: statusesRaw } = useUnitStatuses();

    const types = asArray(typesRaw);
    const statuses = asArray(statusesRaw);
    const depts = asArray(departments);

    const [formData, setFormData] = useState({
        name: '',
        plate_number: '',
        type_id: '',
        status_id: '',
        department_id: '',
        squad_number: '',
        show_in_grid: true,
    });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                plate_number: initialData.plate_number || '',
                type_id: initialData.type_id || '',
                status_id: initialData.status_id || '',
                department_id: initialData.department_id || '',
                squad_number: initialData.squad_number ?? '',
                show_in_grid: initialData.show_in_grid !== false,
            });
        } else {
            // При создании подставляем дефолтный статус "В расчете"
            const defaultStatus = statuses.find(
                (s) => s.short_name === 'В расчете'
            );
            setFormData({
                name: '',
                plate_number: '',
                type_id: '',
                status_id: defaultStatus?.id || '',
                department_id: '',
                squad_number: '',
                show_in_grid: true,
            });
        }
        setLocalError('');
    }, [initialData, open, statuses]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSelectChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');

        if (!formData.name.trim()) {
            setLocalError('Укажите название техники');
            return;
        }
        if (!formData.department_id) {
            setLocalError('Выберите подразделение');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            plate_number: formData.plate_number.trim() || null,
            type_id: formData.type_id || null,
            department_id: formData.department_id,
            squad_number:
                formData.squad_number === '' || formData.squad_number === null
                    ? null
                    : Number(formData.squad_number),
            show_in_grid: formData.show_in_grid,
        };

        // status_id отправляем только при создании.
        // При редактировании статус меняется отдельно (POST /:id/status).
        if (!isEdit && formData.status_id) {
            payload.status_id = formData.status_id;
        }

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать технику' : 'Новая техника'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Название */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Название (марка и модель)</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Например, АЦ-40 Камаз 43118"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                            />
                        </div>

                        {/* Госномер */}
                        <div className="space-y-2">
                            <Label htmlFor="plate_number">Госномер</Label>
                            <Input
                                id="plate_number"
                                name="plate_number"
                                placeholder="А123БВ 777"
                                value={formData.plate_number}
                                onChange={handleChange}
                                className="rounded-lg font-mono"
                            />
                        </div>

                        {/* Тип */}
                        <div className="space-y-2">
                            <Label htmlFor="type_id">Тип техники</Label>
                            <Select
                                value={formData.type_id}
                                onValueChange={(v) => handleSelectChange('type_id', v)}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Выберите тип" />
                                </SelectTrigger>
                                <SelectContent>
                                    {types.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-orange-600 min-w-[60px]">
                          {t.short_name}
                        </span>
                                                <span>{t.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Статус — при создании */}
                        {!isEdit && (
                            <div className="space-y-2">
                                <Label htmlFor="status_id">Начальный статус</Label>
                                <Select
                                    value={formData.status_id}
                                    onValueChange={(v) => handleSelectChange('status_id', v)}
                                >
                                    <SelectTrigger className="rounded-lg">
                                        <SelectValue placeholder="Выберите статус" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statuses.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex items-center gap-2">
                          <span
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                          />
                                                    <span>{s.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Подразделение */}
                        <div className="space-y-2">
                            <Label htmlFor="department_id">Подразделение</Label>
                            <Select
                                value={formData.department_id}
                                onValueChange={(v) => handleSelectChange('department_id', v)}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Выберите подразделение" />
                                </SelectTrigger>
                                <SelectContent>
                                    {depts.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-slate-400">
                                            Нет доступных подразделений
                                        </div>
                                    ) : (
                                        depts.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Отделение и показ в сетке */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="squad_number">Отделение</Label>
                                <Select
                                    value={String(formData.squad_number)}
                                    onValueChange={(v) =>
                                        handleSelectChange(
                                            'squad_number',
                                            v === 'none' ? '' : v
                                        )
                                    }
                                >
                                    <SelectTrigger className="rounded-lg">
                                        <SelectValue placeholder="Не задано" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Не задано</SelectItem>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Показывать в сетке</Label>
                                <label className="flex items-center gap-2 h-10 cursor-pointer rounded-lg border border-slate-200 px-3">
                                    <input
                                        type="checkbox"
                                        name="show_in_grid"
                                        checked={formData.show_in_grid}
                                        onChange={handleChange}
                                        className="h-4 w-4 rounded accent-orange-500"
                                    />
                                    <span className="text-sm text-slate-700">
                    {formData.show_in_grid ? 'Да' : 'Нет'}
                  </span>
                                </label>
                            </div>
                        </div>

                        {/* Ошибка */}
                        {localError && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                                {localError}
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

export default UnitForm;