import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRoles } from '../hooks/useRoles';
import { useAuth } from '../context/AuthContext';

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
import { User, Eye, EyeOff, RefreshCw, Check } from 'lucide-react';
import { useSecuritySettings } from '../hooks/usePasswordSecurity';
import { toLocalInput, toIso } from '../lib/calls';

// Требования политики по её ключу (совпадает с бэкендом, utils/passwordPolicy)
const POLICY_CHECKS = {
    simple: [],
    medium: ['letter', 'digit', 'upper', 'lower'],
    complex: ['letter', 'digit', 'upper', 'lower', 'special'],
};

const POLICY_TESTS = {
    letter: /[A-Za-zА-Яа-яЁё]/,
    digit: /\d/,
    upper: /[A-ZА-ЯЁ]/,
    lower: /[a-zа-яё]/,
    special: /[\p{P}\p{S}]/u,
};

// Проверка пароля по действующей политике (та же логика, что на сервере)
const passwordMeetsPolicy = (pwd, policy) => {
    const password = typeof pwd === 'string' ? pwd : '';
    if (!policy) return password.length >= 8;
    if (password.length < policy.min) return false;
    return (POLICY_CHECKS[policy.key] || []).every((c) => POLICY_TESTS[c].test(password));
};

// Пока фиксированный список ролей. В будущем заменим на API-запрос.

const generatePassword = (length = 12) => {
    const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (n) => chars[n % chars.length]).join('');
};

const UserForm = ({
                      open,
                      onOpenChange,
                      onSubmit,
                      initialData,
                      isLoading,
                      error,
                      departments = [],
                  }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'viewer',
        can_view_all: false,
        departmentIds: [],
        is_blocked: false,
        password_expires_at: '',
    });
    const { user: currentUser } = useAuth();   // ← вот эта строка
    const isSelf = initialData?.id === currentUser?.id;
    const isSelfDeveloper = isSelf && initialData?.role === 'developer';
    const { data: rolesData } = useRoles();
    const roles = (rolesData?.data || []).filter((r) => r.code !== 'developer');

    // Действующая политика сложности пароля (для подсказок и проверки)
    const { data: security } = useSecuritySettings();
    const policy = security?.policy;
    const minLength = policy?.min ?? 8;
    const requirements = policy?.requirements ?? [`минимум ${minLength} символов`];
    const requirementsText = requirements
        .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
        .join(', ');

    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                username: initialData.username || '',
                password: '',
                role: initialData.role || 'viewer',
                can_view_all: initialData.can_view_all || false,
                departmentIds: (initialData.departments || []).map((d) => d.id),
                is_blocked: initialData.is_blocked || false,
                password_expires_at: toLocalInput(initialData.password_expires_at),
            });
        } else {
            setFormData({
                username: '',
                password: '',
                role: 'viewer',
                can_view_all: false,
                departmentIds: [],
                is_blocked: false,
                password_expires_at: '',
            });
        }
        setLocalError('');
        setShowPassword(false);
    }, [initialData, open]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleGenerate = () => {
        setFormData((prev) => ({ ...prev, password: generatePassword(12) }));
        setShowPassword(true);
    };

    const toggleDepartment = (id) => {
        setFormData((prev) => {
            const has = prev.departmentIds.includes(id);
            return {
                ...prev,
                departmentIds: has
                    ? prev.departmentIds.filter((x) => x !== id)
                    : [...prev.departmentIds, id],
            };
        });
    };

    // Простой вывод дерева подразделений в виде плоского списка с отступами
    const buildFlatList = (items) => {
        const map = {};
        const roots = [];
        items.forEach((item) => {
            map[item.id] = { ...item, children: [] };
        });
        items.forEach((item) => {
            if (item.parent_id && map[item.parent_id]) {
                map[item.parent_id].children.push(map[item.id]);
            } else {
                roots.push(map[item.id]);
            }
        });
        const result = [];
        const walk = (nodes, level) => {
            nodes.forEach((n) => {
                result.push({ ...n, level });
                walk(n.children, level + 1);
            });
        };
        walk(roots, 0);
        return result;
    };

    const departmentsFlat = buildFlatList(departments);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');

        // Проверка пароля по действующей политике сложности
        const isEditMode = !!initialData;
        if (!isEditMode && !passwordMeetsPolicy(formData.password, policy)) {
            setLocalError(`Пароль не соответствует требованиям: ${requirementsText}`);
            return;
        }
        if (isEditMode && formData.password && !passwordMeetsPolicy(formData.password, policy)) {
            setLocalError(`Пароль не соответствует требованиям: ${requirementsText}`);
            return;
        }

        const payload = {
            username: formData.username,
            role: formData.role,
            can_view_all: formData.can_view_all,
            departmentIds: formData.departmentIds,
        };

        // Пароль отправляем только если он заполнен
        if (formData.password) {
            payload.password = formData.password;
        }

        // Дату истечения пароля отправляем только если её действительно изменили
        const originalExpiry = toLocalInput(initialData?.password_expires_at);
        if (isEditMode && formData.password_expires_at !== originalExpiry) {
            payload.password_expires_at = formData.password_expires_at
                ? toIso(formData.password_expires_at)
                : null;
        }

        onSubmit(payload);
    };

    const isEdit = !!initialData;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <User className="h-5 w-5 text-orange-500" />
                        {isEdit ? 'Редактировать пользователя' : 'Новый пользователь'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Логин */}
                        <div className="space-y-2">
                            <Label htmlFor="username">Логин</Label>
                            <Input
                                id="username"
                                name="username"
                                placeholder="Введите логин"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className="rounded-lg"
                                autoComplete="username"
                            />
                        </div>

                        {/* Пароль */}
                        <div className="space-y-2">
                            <Label htmlFor="password">
                                {isEdit ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
                            </Label>
                            <input
                                type="password"
                                name="fake-password"
                                autoComplete="new-password"
                                style={{ display: 'none' }}
                                tabIndex={-1}
                            />
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={`Минимум ${minLength} символов`}
                                        value={formData.password}
                                        onChange={handleChange}
                                        required={!isEdit}
                                        className="rounded-lg pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGenerate}
                                    className="rounded-lg"
                                    title="Сгенерировать пароль"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400">
                                Требования: {requirementsText}
                            </p>
                        </div>

                        {/* Дата истечения пароля (только при редактировании) */}
                        {isEdit && (
                            <div className="space-y-2">
                                <Label htmlFor="password_expires_at">
                                    Срок действия пароля до
                                </Label>
                                <Input
                                    id="password_expires_at"
                                    name="password_expires_at"
                                    type="datetime-local"
                                    value={formData.password_expires_at || ''}
                                    onChange={handleChange}
                                    className="rounded-lg"
                                />
                                <p className="text-[11px] text-slate-500">
                                    Пусто — срок не ограничен. Если дату не менять вручную,
                                    при смене пароля срок пересчитается автоматически.
                                </p>
                            </div>
                        )}

                        {/* Роль */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Роль</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({ ...prev, role: value }))
                                }
                                disabled={isSelfDeveloper}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Выберите роль" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((r) => (
                                        <SelectItem key={r.code} value={r.code}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isSelfDeveloper && (
                                <p className="text-xs text-amber-600">
                                    Вы не можете изменить свою роль «Разработчик»
                                </p>
                            )}
                        </div>

                        {/* can_view_all */}
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                            <input
                                id="can_view_all"
                                name="can_view_all"
                                type="checkbox"
                                checked={formData.can_view_all}
                                onChange={handleChange}
                                className="h-4 w-4 rounded accent-orange-500"
                            />
                            <Label htmlFor="can_view_all" className="cursor-pointer text-sm">
                                Видит все подразделения
                            </Label>
                        </div>

                        {/* Подразделения */}
                        {!formData.can_view_all && (
                            <div className="space-y-2">
                                <Label>Подразделения</Label>
                                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                                    {departmentsFlat.length === 0 ? (
                                        <p className="text-sm text-slate-400 p-2">
                                            Нет доступных подразделений
                                        </p>
                                    ) : (
                                        departmentsFlat.map((dept) => {
                                            const checked = formData.departmentIds.includes(dept.id);
                                            return (
                                                <label
                                                    key={dept.id}
                                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                                                    style={{ paddingLeft: `${dept.level * 16 + 8}px` }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleDepartment(dept.id)}
                                                        className="h-4 w-4 rounded accent-orange-500"
                                                    />
                                                    <span className="text-sm text-slate-700">
                            {dept.name}
                          </span>
                                                    {checked && (
                                                        <Check className="h-3 w-3 text-orange-500 ml-auto" />
                                                    )}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">
                                    Выбрано: {formData.departmentIds.length}
                                </p>
                            </div>
                        )}

                        {/* Ошибки */}
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

export default UserForm;