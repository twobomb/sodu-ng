import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useSendBroadcast } from '../../hooks/useSettings';
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
    Settings,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Megaphone,
    Send,
} from 'lucide-react';

const SettingsPage = () => {
    const { data, isLoading, error } = useSettings();
    const updateSettings = useUpdateSettings();
    const sendBroadcast = useSendBroadcast();

    // ---- ТО ----
    const [maintenance, setMaintenance] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [maintenanceMessageType, setMaintenanceMessageType] = useState('info');

    // ---- Broadcast ----
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastText, setBroadcastText] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastMessageType, setBroadcastMessageType] = useState('info');

    useEffect(() => {
        if (data?.data !== undefined) {
            setMaintenance(!!data.data.maintenance_mode);
        }
    }, [data]);

    const handleSaveMaintenance = () => {
        setMaintenanceMessage('');
        updateSettings.mutate(
            { maintenance_mode: maintenance },
            {
                onSuccess: () => {
                    setMaintenanceMessageType('success');
                    setMaintenanceMessage(
                        maintenance
                            ? 'Режим ТО включён. Все пользователи, кроме разработчиков, отключены.'
                            : 'Режим ТО выключен. Пользователи могут входить в систему.'
                    );
                },
                onError: (err) => {
                    setMaintenanceMessageType('error');
                    setMaintenanceMessage(
                        err.response?.data?.error || 'Ошибка сохранения'
                    );
                },
            }
        );
    };

    const handleSendBroadcast = (e) => {
        e.preventDefault();
        setBroadcastMessage('');

        if (!broadcastTitle.trim()) {
            setBroadcastMessageType('error');
            setBroadcastMessage('Введите заголовок');
            return;
        }
        if (!broadcastText.trim()) {
            setBroadcastMessageType('error');
            setBroadcastMessage('Введите текст сообщения');
            return;
        }

        sendBroadcast.mutate(
            { title: broadcastTitle.trim(), message: broadcastText.trim() },
            {
                onSuccess: () => {
                    setBroadcastTitle('');
                    setBroadcastText('');
                    setBroadcastMessageType('success');
                    setBroadcastMessage(
                        'Сообщение отправлено всем пользователям системы.'
                    );
                    setTimeout(() => setBroadcastMessage(''), 4000);
                },
                onError: (err) => {
                    setBroadcastMessageType('error');
                    setBroadcastMessage(
                        err.response?.data?.error || 'Ошибка отправки'
                    );
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки настроек
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="h-6 w-6 text-orange-500" />
                    Конфигурация системы
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Раздел доступен только роли «Разработчик»
                </p>
            </div>

            {/* ============ Broadcast ============ */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Megaphone className="h-5 w-5 text-orange-500" />
                        Системное сообщение
                    </CardTitle>
                    <CardDescription>
                        Отправить всплывающее сообщение всем активным пользователям. Оно
                        появится по центру экрана и будет висеть, пока пользователь не
                        нажмёт «Понятно».
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSendBroadcast} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="b-title">Заголовок</Label>
                            <Input
                                id="b-title"
                                value={broadcastTitle}
                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                placeholder="Например, Важное объявление"
                                maxLength={200}
                                className="rounded-lg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="b-text">Текст сообщения</Label>
                            <textarea
                                id="b-text"
                                value={broadcastText}
                                onChange={(e) => setBroadcastText(e.target.value)}
                                placeholder="Введите текст, который увидят все пользователи..."
                                rows={6}
                                maxLength={5000}
                                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[120px]"
                            />
                            <p className="text-xs text-slate-400 text-right">
                                {broadcastText.length} / 5000
                            </p>
                        </div>

                        {broadcastMessage && (
                            <div
                                className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                                    broadcastMessageType === 'error'
                                        ? 'bg-red-50 text-red-600 border-red-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                }`}
                            >
                                {broadcastMessageType !== 'error' && (
                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                )}
                                {broadcastMessage}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={
                                    sendBroadcast.isPending ||
                                    !broadcastTitle.trim() ||
                                    !broadcastText.trim()
                                }
                                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg gap-2"
                            >
                                {sendBroadcast.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Отправка...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Отправить всем
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* ============ Техническое обслуживание ============ */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="h-5 w-5 text-orange-500" />
                        Техническое обслуживание
                    </CardTitle>
                    <CardDescription>
                        При включении все пользователи, кроме разработчиков, будут
                        отключены от системы и не смогут войти до выключения режима.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={maintenance}
                            onChange={(e) => setMaintenance(e.target.checked)}
                            className="h-5 w-5 mt-0.5 rounded accent-orange-500"
                        />
                        <div className="flex-1">
                            <div className="font-medium text-slate-800">
                                Режим технического обслуживания
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Текущие сессии всех обычных пользователей будут принудительно
                                завершены, и они не смогут войти снова до выключения режима.
                            </p>
                        </div>
                    </label>

                    {maintenance && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-orange-700">
                                Режим ТО будет включён при сохранении. Все обычные
                                пользователи будут выкинуты из системы.
                            </p>
                        </div>
                    )}

                    {maintenanceMessage && (
                        <div
                            className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                                maintenanceMessageType === 'error'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-green-50 text-green-700 border-green-200'
                            }`}
                        >
                            {maintenanceMessageType !== 'error' && (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {maintenanceMessage}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveMaintenance}
                            disabled={updateSettings.isPending}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                        >
                            {updateSettings.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                'Сохранить'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SettingsPage;