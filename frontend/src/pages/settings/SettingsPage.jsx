import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Loader2, Settings, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';

const SettingsPage = () => {
    const { data, isLoading, error } = useSettings();
    const updateSettings = useUpdateSettings();
    const [maintenance, setMaintenance] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');

    useEffect(() => {
        if (data?.data) {
            setMaintenance(!!data.data.maintenance_mode);
        }
    }, [data]);

    const handleSave = () => {
        setMessage('');
        updateSettings.mutate(
            { maintenance_mode: maintenance },
            {
                onSuccess: () => {
                    setMessageType('success');
                    setMessage(
                        maintenance
                            ? 'Режим ТО включён. Все пользователи, кроме разработчиков, отключены от системы.'
                            : 'Режим ТО выключен. Пользователи могут входить в систему.'
                    );
                },
                onError: (err) => {
                    setMessageType('error');
                    setMessage(err.response?.data?.error || 'Ошибка сохранения');
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

            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="h-5 w-5 text-orange-500" />
                        Техническое обслуживание
                    </CardTitle>
                    <CardDescription>
                        При включении все пользователи, кроме разработчиков, будут отключены
                        от системы и не смогут войти до выключения режима.
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
                                Режим ТО будет включён при сохранении. Все обычные пользователи
                                будут выкинуты из системы.
                            </p>
                        </div>
                    )}

                    {message && (
                        <div
                            className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                                messageType === 'error'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-green-50 text-green-700 border-green-200'
                            }`}
                        >
                            {messageType !== 'error' && (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {message}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSave}
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