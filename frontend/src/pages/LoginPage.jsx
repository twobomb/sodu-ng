import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initAudio } from '../lib/notificationSound';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { User, Lock, Loader2, Flame, Shield, AlertTriangle, Info } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('warning'); // 'warning' | 'info'
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Читаем причину выхода из sessionStorage при монтировании страницы
  useEffect(() => {
    const reason = sessionStorage.getItem('logout_reason');
    if (!reason) return;

    switch (reason) {
      case 'session_replaced':
        setNotice('Сессия завершена: выполнен вход с другого устройства.');
        setNoticeType('warning');
        break;
      case 'blocked':
        setNotice('Ваш аккаунт заблокирован администратором.');
        setNoticeType('warning');
        break;
      case 'maintenance_mode':
        // НЕ показываем на LoginPage — заглушка обрабатывается MaintenanceGuard
        // Но на всякий случай дублируем как уведомление, если пользователь сюда попал
        break;
      default:
        break;
    }

    // Не удаляем сразу — дадим MaintenanceGuard прочитать флаг.
    // Удаляем при успешном логине или при ручной перезагрузке.
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    // Инициализация AudioContext прямо в обработчике клика —
    // это даёт браузеру понять, что пользователь взаимодействовал
    initAudio();

    try {
      await login(username, password);
      // На всякий случай очищаем причину перед редиректом
      sessionStorage.removeItem('logout_reason');
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.maintenance) {
        setNotice(
            data.error || 'Система на техническом обслуживании. Попробуйте позже.'
        );
        setNoticeType('info');
      } else {
        setError(data?.error || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 rounded-2xl">
          <CardHeader className="space-y-1 text-center pt-10 pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <Flame className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold tracking-tight text-slate-800">
              СОДУ
            </CardTitle>
            <CardDescription className="text-base text-slate-500 font-medium">
              Система оперативного диспетчерского управления
            </CardDescription>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2">
              <Shield className="h-3 w-3" />
              <span>Безопасный вход</span>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-8">
              {/* Предупреждение о причине выхода */}
              {notice && (
                  <div
                      className={`text-sm p-3 rounded-lg border flex items-start gap-2 ${
                          noticeType === 'info'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                  >
                    {noticeType === 'info' ? (
                        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{notice}</span>
                  </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                  Логин
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                      id="username"
                      type="text"
                      placeholder="Введите логин"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 h-11 border-slate-200 focus:border-orange-500 focus:ring-orange-500 rounded-lg"
                      autoComplete="username"
                      required
                      autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Пароль
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                      id="password"
                      type="password"
                      placeholder="Введите пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11 border-slate-200 focus:border-orange-500 focus:ring-orange-500 rounded-lg"
                      autoComplete="current-password"
                      required
                  />
                </div>
              </div>

              {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    {error}
                  </div>
              )}
            </CardContent>

            <CardFooter className="px-8 pb-10 pt-2">
              <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={loading}
              >
                {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Вход...
                    </>
                ) : (
                    'Войти в систему'
                )}
              </Button>
            </CardFooter>
          </form>

          <div className="text-center text-xs text-slate-400 pb-6">
            © 2026 СОДУ — Все права защищены
          </div>
        </Card>
      </div>
  );
};

export default LoginPage;