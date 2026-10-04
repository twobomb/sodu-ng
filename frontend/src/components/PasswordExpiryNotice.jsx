import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, KeyRound } from 'lucide-react';

// Склонение слова «день»
const pluralDays = (n) => {
    const abs = Math.abs(Number(n)) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'дней';
    if (last === 1) return 'день';
    if (last >= 2 && last <= 4) return 'дня';
    return 'дней';
};

/**
 * Предупреждение о скором истечении (или истечении) срока действия пароля.
 * Показывается на всех страницах приложения под меню.
 * Не отображается для ролей с правом «Бессрочный пароль».
 */
const PasswordExpiryNotice = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user || user.password_never_expires) return null;
    if (!user.password_expiring_soon) return null;

    const expired = !!user.password_expired;
    const days = user.password_days_left ?? 0;

    return (
        <div
            className={`mb-4 rounded-xl border flex flex-wrap items-center gap-3 px-4 py-3 ${
                expired
                    ? 'border-red-300 bg-red-50'
                    : 'border-amber-300 bg-amber-50'
            }`}
        >
            <AlertTriangle
                className={`h-5 w-5 shrink-0 ${
                    expired ? 'text-red-600' : 'text-amber-600'
                }`}
            />
            <div className="flex-1 min-w-0">
                <p
                    className={`text-sm font-medium ${
                        expired ? 'text-red-800' : 'text-amber-800'
                    }`}
                >
                    {expired
                        ? 'Срок действия вашего пароля истёк'
                        : 'Срок действия пароля скоро истекает'}
                </p>
                <p
                    className={`text-xs ${
                        expired ? 'text-red-700' : 'text-amber-700'
                    }`}
                >
                    {expired
                        ? 'Смените пароль, чтобы продолжить работу. Если не получается — обратитесь к администратору.'
                        : `Осталось ${days} ${pluralDays(days)}. Рекомендуем сменить пароль заранее.`}
                </p>
            </div>
            <Button
                size="sm"
                onClick={() => navigate('/settings?tab=security')}
                className={`rounded-lg shrink-0 ${
                    expired
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                }`}
            >
                <KeyRound className="h-4 w-4 mr-2" />
                Изменить пароль
            </Button>
        </div>
    );
};

export default PasswordExpiryNotice;
