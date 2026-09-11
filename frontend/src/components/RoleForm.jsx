import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Shield, ChevronRight, ChevronDown, Check } from 'lucide-react';

const RoleForm = ({ open, onOpenChange, onSubmit, initialData, isLoading, error, catalog }) => {
    const [formData, setFormData] = useState({
        code: '', name: '', description: '', permissions: [],
    });
    const [expanded, setExpanded] = useState({});
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code,
                name: initialData.name || '',
                description: initialData.description || '',
                permissions: initialData.permissions || [],
            });
        } else {
            setFormData({ code: '', name: '', description: '', permissions: [] });
        }
        setLocalError('');
        // разворачиваем все секции по умолчанию
        const init = {};
        (catalog || []).forEach((s) => { init[s.key] = true; });
        setExpanded(init);
    }, [initialData, open, catalog]);

    const isEdit = !!initialData;

    const togglePermission = (permKey) => {
        setFormData((prev) => {
            const has = prev.permissions.includes(permKey);
            return {
                ...prev,
                permissions: has
                    ? prev.permissions.filter((p) => p !== permKey)
                    : [...prev.permissions, permKey],
            };
        });
    };

    const toggleSection = (section) => {
        const sectionKeys = section.permissions.map((p) => p.key);
        const allSelected = sectionKeys.every((k) => formData.permissions.includes(k));
        setFormData((prev) => ({
            ...prev,
            permissions: allSelected
                ? prev.permissions.filter((k) => !sectionKeys.includes(k))
                : Array.from(new Set([...prev.permissions, ...sectionKeys])),
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');

        if (!isEdit) {
            if (!/^[a-z][a-z0-9_]*$/.test(formData.code)) {
                setLocalError('Код роли: латиница в нижнем регистре, цифры и _');
                return;
            }
        }
        if (!formData.name.trim()) {
            setLocalError('Укажите название роли');
            return;
        }

        const payload = {
            name: formData.name,
            description: formData.description || null,
            permissions: formData.permissions,
        };
        if (!isEdit) payload.code = formData.code;

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Shield className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать роль' : 'Новая роль'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Код роли */}
                        <div className="space-y-2">
                            <Label htmlFor="code">Код роли</Label>
                            <Input
                                id="code"
                                name="code"
                                placeholder="например, operator"
                                value={formData.code}
                                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                                disabled={isEdit}
                                required={!isEdit}
                                className="rounded-lg font-mono"
                            />
                            <p className="text-xs text-slate-400">
                                Используется в коде. Только a-z, 0-9 и _. После создания изменить нельзя.
                            </p>
                        </div>

                        {/* Название */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Название</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Например, Оператор"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                required
                                className="rounded-lg"
                            />
                        </div>

                        {/* Описание */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Описание (необязательно)</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Краткое описание роли"
                                value={formData.description}
                                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                                className="rounded-lg"
                            />
                        </div>

                        {/* Правила по секциям */}
                        <div className="space-y-3">
                            <Label>Правила доступа</Label>
                            <p className="text-xs text-slate-400">
                                Выбрано правил: <strong>{formData.permissions.length}</strong>
                            </p>

                            <div className="space-y-2">
                                {(catalog || []).map((section) => {
                                    const sectionKeys = section.permissions.map((p) => p.key);
                                    const allSelected = sectionKeys.every((k) =>
                                        formData.permissions.includes(k)
                                    );
                                    const someSelected = sectionKeys.some((k) =>
                                        formData.permissions.includes(k)
                                    );
                                    const isOpen = expanded[section.key];

                                    return (
                                        <div
                                            key={section.key}
                                            className="rounded-lg border border-slate-200 overflow-hidden"
                                        >
                                            {/* Заголовок секции */}
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpanded((p) => ({ ...p, [section.key]: !p[section.key] }))
                                                    }
                                                    className="text-slate-500 hover:text-slate-700"
                                                >
                                                    {isOpen ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>

                                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        ref={(el) => {
                                                            if (el) el.indeterminate = someSelected && !allSelected;
                                                        }}
                                                        onChange={() => toggleSection(section)}
                                                        className="h-4 w-4 rounded accent-orange-500"
                                                    />
                                                    <span className="font-semibold text-slate-800 text-sm">
                            {section.name}
                          </span>
                                                    {section.description && (
                                                        <span className="text-xs text-slate-400 hidden sm:inline">
                              — {section.description}
                            </span>
                                                    )}
                                                </label>

                                                <span className="text-xs text-slate-500">
                          {sectionKeys.filter((k) => formData.permissions.includes(k)).length}
                                                    /{sectionKeys.length}
                        </span>
                                            </div>

                                            {/* Список правил */}
                                            {isOpen && (
                                                <div className="p-2 space-y-0.5">
                                                    {section.permissions.map((perm) => {
                                                        const checked = formData.permissions.includes(perm.key);
                                                        return (
                                                            <label
                                                                key={perm.key}
                                                                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => togglePermission(perm.key)}
                                                                    className="h-4 w-4 mt-0.5 rounded accent-orange-500"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-700 font-medium">
                                      {perm.name}
                                    </span>
                                                                        <span className="text-xs font-mono text-slate-400">
                                      {perm.key}
                                    </span>
                                                                        {checked && (
                                                                            <Check className="h-3 w-3 text-orange-500 ml-auto" />
                                                                        )}
                                                                    </div>
                                                                    {perm.description && (
                                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                                            {perm.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
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
                            {isLoading ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RoleForm;