import { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '@/components/ui/searchable-select';

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

    const { user } = useAuth();

    const depts = useMemo(() => {
        const all = asArray(departments);
        if (user?.can_view_all) return all;
        const ids = user?.department_ids || [];
        return all.filter((d) => ids.includes(d.id));
    }, [departments, user]);

    const [formData, setFormData] = useState({
        name: '',
        plate_number: '',
        type_id: '',
        status_id: '',
        department_id: '',
        squad_number: '',
        show_in_grid: true,
        fuel_gasoline: '',
        fuel_diesel: '',
        foam_agent: '',
        powder: '',
        mileage: '',
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
            const defaultStatus = statuses.find((s) => s.short_name === 'В расчете');
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

    // Опции для SearchableSelect: тип техники
    const typeOptions = useMemo(
        () =>
            types.map((t) => ({
                value: t.id,
                label: t.short_name,
                extra: t.name,
                search: `${t.short_name} ${t.name}`.toLowerCase(),
            })),
        [types]
    );

    // Опции для SearchableSelect: подразделения
    const deptOptions = useMemo(
        () =>
            depts.map((d) => ({
                value: d.id,
                label: d.name,
                extra: d.full_name || '',
                search: `${d.name} ${d.full_name || ''}`.toLowerCase(),
            })),
        [depts]
    );

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

        if (!isEdit && formData.status_id) {
            payload.status_id = formData.status_id;
        }

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
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

                        {/* Тип техники — SearchableSelect */}
                        <div className="space-y-2">
                            <Label>Тип техники</Label>
                            <SearchableSelect
                                options={typeOptions}
                                value={formData.type_id}
                                onChange={(v) => handleSelectChange('type_id', v)}
                                placeholder="Выберите тип"
                                emptyText="Нет доступных типов"
                                renderOption={(opt) => (
                                    <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-orange-600 min-w-[60px] flex-shrink-0">
                      {opt.label}
                    </span>
                                        <span className="text-sm text-slate-700 truncate">
                      {opt.extra}
                    </span>
                                    </div>
                                )}
                                renderValue={(opt) => (
                                    <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-orange-600 flex-shrink-0">
                      {opt.label}
                    </span>
                                        <span className="text-sm text-slate-800 truncate">
                      {opt.extra}
                    </span>
                                    </div>
                                )}
                            />
                        </div>

                        {/* Начальный статус — при создании, обычный Select */}
                        {!isEdit && (
                            <div className="space-y-2">
                                <Label>Начальный статус</Label>
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

                        {/* Подразделение — SearchableSelect */}
                        <div className="space-y-2">
                            <Label>Подразделение</Label>
                            <SearchableSelect
                                options={deptOptions}
                                value={formData.department_id}
                                onChange={(v) => handleSelectChange('department_id', v)}
                                placeholder="Выберите подразделение"
                                emptyText="Нет доступных подразделений"
                                renderOption={(opt) => (
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm truncate">{opt.label}</span>
                                        {opt.extra && (
                                            <span className="text-[11px] text-slate-400 truncate">
                        {opt.extra}
                      </span>
                                        )}
                                    </div>
                                )}
                            />
                            {depts.length === 0 && (
                                <p className="text-xs text-amber-600">
                                    У вас нет доступа ни к одному подразделению
                                </p>
                            )}
                        </div>

                        {/* Отделение и показ в сетке */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Отделение</Label>
                                <Select
                                    value={String(formData.squad_number)}
                                    onValueChange={(v) =>
                                        handleSelectChange('squad_number', v === 'none' ? '' : v)
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