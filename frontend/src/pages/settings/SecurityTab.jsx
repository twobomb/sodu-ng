import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import {
    useSecuritySettings,
    useChangePassword,
} from '../../hooks/usePasswordSecurity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Loader2,
    Shield,
    KeyRound,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Eye,
    EyeOff,
    Infinity as InfinityIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// Склонение слова «день» для подсказок о сроке действия
const pluralDays = (n) => {
    const abs = Math.abs(Number(n)) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'дней';
    if (last === 1) return 'день';
    if (last >= 2 && last <= 4) return 'дня';
    return 'дней';
};

const SecurityTab = () => {
    const { user, refreshUser } = useAuth();
    const { data: settings } = useSecuritySettings();
    const changePassword = useChangePassword();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState('');

    const policy = settings?.policy;
    const minLength = policy?.min ?? 8;
    const requirements = policy?.requirements ?? [`минимум ${minLength} символов`];
    const warningDays = user?.password_warning_days ?? 5;

    const neverExpires = !!user?.password_never_expires;
    const expired = !!user?.password_expired;
    const daysLeft = user?.password_days_left;
    const expiresAt = user?.password_expires_at
        ? new Date(user.password_expires_at)
        : null;
    const expiringSoon = !!user?.password_expiring_soon;

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < minLength) {
            setError(`Пароль должен содержать минимум ${minLength} символов`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Новый пароль и подтверждение не совпадают');
            return;
        }
        if (newPassword === currentPassword) {
            setError('Новый пароль должен отличаться от текущего');
            return;
        }

        changePassword.mutate(
            { currentPassword, newPassword },
            {
                onSuccess: async () => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    toast.success('Пароль изменён');
                    // Обновляем профиль — обновятся сведения о сроке действия
                    try {
                        await refreshUser();
                    } catch {
                        /* профиль обновится при следующем запросе */
                    }
                },
                onError: (err) =>
                    setError(
                        err?.response?.data?.error || 'Не удалось изменить пароль'
                    ),
            }
        );
    };

    return (
        <div className="space-y-4">

            {/* Текущий статус пароля */}
            <Card
                className={`rounded-2xl shadow-sm border ${
                    expired
                        ? 'border-red-200 bg-red-50'
                        : expiringSoon
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200'
                }`}
            >
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield
                            className={`h-5 w-5 ${
                                expired
                                    ? 'text-red-500'
                                    : expiringSoon
                                        ? 'text-amber-500'
                                        : 'text-orange-500'
                            }`}
                        />
                        Срок действия пароля
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {neverExpires ? (
                        <p className="text-sm text-emerald-700 flex items-center gap-2">
                            <InfinityIcon className="h-4 w-4" />
                            Для вашей роли включён «Бессрочный пароль» — срок
                            действия не ограничен.
                        </p>
                    ) : expiresAt ? (
                        <>
                            <p className="text-sm text-slate-700">
                                Пароль действует до{' '}
                                <span className="font-semibold">
                                    {format(expiresAt, 'd MMMM yyyy, HH:mm', {
                                        locale: ru,
                                    })}
                                </span>
                            </p>
                            {expired ? (
                                <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Срок действия пароля истёк. Обратитесь к
                                    администратору.
                                </p>
                            ) : (
                                <p
                                    className={`text-sm font-medium flex items-center gap-2 ${
                                        expiringSoon
                                            ? 'text-amber-700'
                                            : 'text-slate-600'
                                    }`}
                                >
                                    <Clock className="h-4 w-4" />
                                    Осталось {daysLeft} {pluralDays(daysLeft)}
                                    {expiringSoon
                                        ? ' — рекомендуем сменить пароль'
                                        : ''}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">
                            Срок действия пароля не ограничен.
                        </p>
                    )}

                    {/* Действующие требования к паролю */}
                    <div className="pt-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase">
                            Требования к паролю
                            {policy?.label ? ` (${policy.label})` : ''}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {requirements.map((r) => (
                                <li
                                    key={r}
                                    className="text-xs text-slate-600 flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="h-3 w-3 text-slate-400 shrink-0" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
            </Card>

            {/* Смена пароля */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <KeyRound className="h-5 w-5 text-orange-500" />
                        Изменить пароль
                    </CardTitle>
                    <CardDescription>
                        {warningDays > 0
                            ? `Смена пароля продлит срок его действия. Обычно предупреждаем за ${warningDays} ${pluralDays(warningDays)} до истечения.`
                            : 'Введите текущий пароль и новый пароль'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label htmlFor="current_password">Текущий пароль</Label>
                            <Input
                                id="current_password"
                                type={showPasswords ? 'text' : 'password'}
                                value={currentPassword}
                                autoComplete="current-password"
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                className="rounded-lg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new_password">Новый пароль</Label>
                            <Input
                                id="new_password"
                                type={showPasswords ? 'text' : 'password'}
                                value={newPassword}
                                autoComplete="new-password"
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="rounded-lg"
                            />
                            <p className="text-[11px] text-slate-500">
                                Минимум {minLength} символов
                                {requirements.length > 1
                                    ? `, ${requirements.slice(1).join(', ')}`
                                    : ''}
                                .
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm_password">
                                Повторите новый пароль
                            </Label>
                            <Input
                                id="confirm_password"
                                type={showPasswords ? 'text' : 'password'}
                                value={confirmPassword}
                                autoComplete="new-password"
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="rounded-lg"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showPasswords}
                                onChange={(e) => setShowPasswords(e.target.checked)}
                                className="h-4 w-4 rounded accent-orange-500"
                            />
                            {showPasswords ? (
                                <EyeOff className="h-4 w-4 text-slate-400" />
                            ) : (
                                <Eye className="h-4 w-4 text-slate-400" />
                            )}
                            Показать пароли
                        </label>

                        {error && (
                            <div className="text-sm p-3 rounded-lg border bg-red-50 text-red-600 border-red-200 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={changePassword.isPending}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                        >
                            {changePassword.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                'Сохранить пароль'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default SecurityTab;

