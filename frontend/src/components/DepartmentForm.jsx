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
import { useAllMunicipalities } from '../hooks/useMunicipalities';
import { useAllDepartmentTypes } from '../hooks/useDepartmentTypes';
import { useAllGarrisons } from '../hooks/useGarrisons';
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
        municipality_id: '',
        department_type_id: '',
        garrison_id: '',
    });
    const [localError, setLocalError] = useState('');

    const municipalityQuery = useAllMunicipalities();
    const muniData = municipalityQuery.data;
    const muniList = Array.isArray(muniData) ? muniData : (muniData?.data || []);

    const departmentTypeQuery = useAllDepartmentTypes();
    const dtData = departmentTypeQuery.data;
    const dtList = Array.isArray(dtData) ? dtData : (dtData?.data || []);

    const garrisonQuery = useAllGarrisons();
    const garrisonData = garrisonQuery.data;
    const garrisonList = Array.isArray(garrisonData) ? garrisonData : (garrisonData?.data || []);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                full_name: initialData.full_name || '',
                address: initialData.address || '',
                phone: initialData.phone || '',
                parent_id: initialData.parent_id || '',
                municipality_id: initialData.municipality_id || '',
                department_type_id: initialData.department_type_id || '',
                garrison_id: initialData.garrison_id || '',
            });
        } else {
            setFormData({
                name: '',
                full_name: '',
                address: '',
                phone: '',
                parent_id: '',
                municipality_id: '',
                department_type_id: '',
                garrison_id: '',
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

    // Опции округов: "Без округа" + список округов
    const muniOptions = useMemo(
        () => [
            {value: '', label: 'Без округа', extra: '', search: 'без округа'},
            ...muniList.map((m) => ({
                value: m.id,
                label: m.name,
                extra: '',
                search: `${m.name}`.toLowerCase(),
            })),
        ],
        [muniList]
    );

    // Опции видов подразделений: "Без вида" + список видов
    const deptTypeOptions = useMemo(
        () => [
            {value: '', label: 'Без вида', extra: '', search: 'без вида'},
            ...dtList.map((t) => ({
                value: t.id,
                label: t.name,
                extra: '',
                search: `${t.name}`.toLowerCase(),
            })),
        ],
        [dtList]
    );

    // Опции гарнизонов: "Без гарнизона" + список гарнизонов
    const garrisonOptions = useMemo(
        () => [
            {value: '', label: 'Без гарнизона', extra: '', search: 'без гарнизона'},
            ...garrisonList.map((g) => ({
                value: g.id,
                label: g.name,
                extra: '',
                search: `${g.name}`.toLowerCase(),
            })),
        ],
        [garrisonList]
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
            municipality_id: formData.municipality_id === '' ? null : formData.municipality_id,
            department_type_id: formData.department_type_id === '' ? null : formData.department_type_id,
            garrison_id: formData.garrison_id === '' ? null : formData.garrison_id,
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

                        {/* Округ */}
                        <div className="space-y-2">
                            <Label>Округ</Label>
                            <SearchableSelect
                                options={muniOptions}
                                value={formData.municipality_id || ''}
                                onChange={(v) => handleSelectChange('municipality_id', v)}
                                placeholder="Без округа"
                                emptyText="Округов не добавлено. Создайте их на странице «Округа»."
                                renderOption={(opt) => (
                                    <span className="text-sm truncate">{opt.label}</span>
                                )}
                            />
                        </div>

                        {/* Вид подразделения */}
                        <div className="space-y-2">
                            <Label>Вид подразделения</Label>
                            <SearchableSelect
                                options={deptTypeOptions}
                                value={formData.department_type_id || ''}
                                onChange={(v) => handleSelectChange('department_type_id', v)}
                                placeholder="Без вида"
                                emptyText="Видов не добавлено. Создайте их на странице «Виды подразделений»."
                                renderOption={(opt) => (
                                    <span className="text-sm truncate">{opt.label}</span>
                                )}
                            />
                        </div>

                        {/* Гарнизон */}
                        <div className="space-y-2">
                            <Label>Гарнизон</Label>
                            <SearchableSelect
                                options={garrisonOptions}
                                value={formData.garrison_id || ''}
                                onChange={(v) => handleSelectChange('garrison_id', v)}
                                placeholder="Без гарнизона"
                                emptyText="Гарнизонов не добавлено. Создайте их на странице «Гарнизоны»."
                                renderOption={(opt) => (
                                    <span className="text-sm truncate">{opt.label}</span>
                                )}
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