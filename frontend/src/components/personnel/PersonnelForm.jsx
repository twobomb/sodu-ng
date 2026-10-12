import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useUnits } from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '@/components/ui/searchable-select';

const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    return [];
};

// ============================================================
// Форма личного состава.
// Человек обязательно привязан к подразделению; техника — того же
// подразделения (выбор фильтруется по выбранному подразделению).
// ============================================================
const PersonnelForm = ({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    isLoading,
    error,
    departments,
    isEdit = false,
}) => {
    const { has } = usePermissions();
    const { user } = useAuth();
    const { data: unitsRaw } = useUnits({ enabled: has('units.view') });
    const units = asArray(unitsRaw);

    // Показываем только те подразделения, к которым есть доступ у пользователя
    const depts = useMemo(() => {
        const all = asArray(departments);
        if (user?.can_view_all) return all;
        const ids = user?.department_ids || (user?.departments || []).map((d) => d.id);
        return all.filter((d) => ids.includes(d.id));
    }, [departments, user]);

    const [formData, setFormData] = useState({
        full_name: '',
        department_id: '',
        position: '',
        rank_name: '',
        phone: '',
        note: '',
        unit_id: '',
    });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                full_name: initialData.full_name || '',
                department_id: initialData.department_id || '',
                position: initialData.position || '',
                rank_name: initialData.rank_name || '',
                phone: initialData.phone || '',
                note: initialData.note || '',
                unit_id: initialData.unit_id || '',
            });
        } else {
            setFormData({
                full_name: '',
                department_id: '',
                position: '',
                rank_name: '',
                phone: '',
                note: '',
                unit_id: '',
            });
        }
        setLocalError('');
    }, [initialData, open]);

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

    // Техника выбранного подразделения
    const unitOptions = useMemo(
        () =>
            units
                .filter((u) => u.department_id === formData.department_id)
                .map((u) => ({
                    value: u.id,
                    label: u.name,
                    extra: [u.type_short_name, u.plate_number].filter(Boolean).join(' · '),
                })),
        [units, formData.department_id]
    );

    const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

    // При смене подразделения сбрасываем технику, если она не из нового подразделения
    const changeDepartment = (deptId) => {
        setFormData((p) => {
            const stillValid = units.some((u) => u.id === p.unit_id && u.department_id === deptId);
            return { ...p, department_id: deptId, unit_id: stillValid ? p.unit_id : '' };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.full_name.trim()) {
            setLocalError('Укажите ФИО');
            return;
        }
        if (!formData.department_id) {
            setLocalError('Выберите подразделение');
            return;
        }
        onSubmit({
            full_name: formData.full_name.trim(),
            department_id: formData.department_id,
            position: formData.position.trim(),
            rank_name: formData.rank_name.trim(),
            phone: formData.phone.trim(),
            note: formData.note.trim(),
            unit_id: formData.unit_id || null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Редактирование человека' : 'Новый человек'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="full_name">ФИО *</Label>
                        <Input
                            id="full_name"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleChange}
                            placeholder="Фамилия Имя Отчество"
                            disabled={isLoading}
                            className="rounded-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Подразделение *</Label>
                        <SearchableSelect
                            options={deptOptions}
                            value={formData.department_id}
                            onChange={changeDepartment}
                            placeholder="Выберите подразделение..."
                            emptyText="Нет доступных подразделений"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="rank_name">Звание</Label>
                            <Input
                                id="rank_name"
                                name="rank_name"
                                value={formData.rank_name}
                                onChange={handleChange}
                                placeholder="Например, сержант"
                                disabled={isLoading}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="position">Должность</Label>
                            <Input
                                id="position"
                                name="position"
                                value={formData.position}
                                onChange={handleChange}
                                placeholder="Например, пожарный"
                                disabled={isLoading}
                                className="rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Номер телефона</Label>
                        <Input
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+7 ___ ___-__-__"
                            disabled={isLoading}
                            className="rounded-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Техника (не обязательно)</Label>
                        <SearchableSelect
                            options={unitOptions}
                            value={formData.unit_id}
                            onChange={(v) => setFormData((p) => ({ ...p, unit_id: v === p.unit_id ? '' : v }))}
                            placeholder={
                                formData.department_id
                                    ? 'Выберите технику...'
                                    : 'Сначала выберите подразделение'
                            }
                            emptyText="Нет техники этого подразделения"
                            disabled={isLoading || !formData.department_id}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Примечание</Label>
                        <Textarea
                            id="note"
                            name="note"
                            rows={3}
                            value={formData.note}
                            onChange={handleChange}
                            placeholder="Дополнительная информация..."
                            disabled={isLoading}
                            className="rounded-lg"
                        />
                    </div>

                    {(localError || error) && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                            {localError || error}
                        </div>
                    )}

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

export default PersonnelForm;
