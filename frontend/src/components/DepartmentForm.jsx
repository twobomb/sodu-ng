import {useState, useEffect, useMemo} from 'react';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/searchable-select';
import {Building2, Loader2} from 'lucide-react';

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
        full_name: '',
        address: '',
        phone: '',
        parent_id: '',
    });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                full_name: initialData.full_name || '',
                address: initialData.address || '',
                phone: initialData.phone || '',
                parent_id: initialData.parent_id || '',
            });
        } else {
            setFormData({
                name: '',
                full_name: '',
                address: '',
                phone: '',
                parent_id: '',
            });
        }
        setLocalError('');
    }, [initialData, open]);

    const isEdit = !!initialData;

    // Показываем только корневые подразделения, кроме самого себя
    const availableParents = (departments || []).filter(
        (d) => !d.parent_id && d.id !== initialData?.id
    );

    // Если у редактируемого есть дети — запрещаем менять родителя
    const hasChildren = (departments || []).some(
        (d) => d.parent_id === initialData?.id
    );
    const canChangeParent = !hasChildren;

    // Опции для SearchableSelect: "Нет (корневое)" + корневые подразделения
    const parentOptions = useMemo(
        () => [
            {value: '', label: 'Нет (корневое)', extra: '', search: 'нет корневое'},
            ...availableParents.map((d) => ({
                value: d.id,
                label: d.name,
                extra: d.full_name || '',
                search: `${d.name} ${d.full_name || ''}`.toLowerCase(),
            })),
        ],
        [availableParents]
    );

    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData((prev) => ({...prev, [name]: value}));
    };

    const handleSelectChange = (field, value) => {
        setFormData((prev) => ({...prev, [field]: value}));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');

        if (!formData.name.trim()) {
            setLocalError('Укажите сокращённое название');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            full_name: formData.full_name.trim() || null,
            address: formData.address.trim() || null,
            phone: formData.phone.trim() || null,
            parent_id: formData.parent_id === '' ? null : formData.parent_id,
        };

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="h-5 w-5 text-orange-500"/>
                        {isEdit ? 'Редактировать подразделение' : 'Новое подразделение'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Сокращённое название */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Сокращённое название</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Например, 1 ПСЧ"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                            />
                            <p className="text-xs text-slate-400">
                                Короткое обозначение, используется в списках
                            </p>
                        </div>

                        {/* Полное название */}
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Полное название</Label>
                            <Input
                                id="full_name"
                                name="full_name"
                                placeholder="Например, 1 Пожарно-спасательная часть"
                                value={formData.full_name}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>

                        {/* Адрес */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес</Label>
                            <Input
                                id="address"
                                name="address"
                                placeholder="например, г. Луганск, ул. Алексеева, 12"
                                value={formData.address}
                                onChange={handleChange}
                                className="rounded-lg"
                            />
                        </div>

                        {/* Телефон */}
                        <div className="space-y-2">
                            <Label htmlFor="phone">Телефон</Label>
                            <Input
                                id="phone"
                                name="phone"
                                placeholder="50-18-00; +7 (959) 123-45-67"
                                value={formData.phone}
                                onChange={handleChange}
                                className="rounded-lg font-mono"
                            />
                        </div>

                        {/* Родительское подразделение */}
                        <div className="space-y-2">
                            <Label>Родительское подразделение</Label>
                            <SearchableSelect
                                options={parentOptions}
                                value={formData.parent_id || ''}
                                onChange={(v) => handleSelectChange('parent_id', v)}
                                placeholder="Нет (корневое)"
                                emptyText="Нет доступных подразделений"
                                disabled={!canChangeParent}
                                renderOption={(opt) =>
                                    opt.value === '' ? (
                                        <span className="text-sm">{opt.label}</span>
                                    ) : (
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm truncate">{opt.label}</span>
                                            {opt.extra && (
                                                <span className="text-[11px] text-slate-400 truncate">
                                                    {opt.extra}
                                                </span>
                                            )}
                                        </div>
                                    )
                                }
                            />
                            {!canChangeParent && (
                                <p className="text-xs text-amber-600">
                                    У этого подразделения есть дети — сначала перенесите их.
                                </p>
                            )}
                            <p className="text-xs text-slate-400">
                                Максимум 2 уровня: корень и дети.
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
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
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

export default DepartmentForm;