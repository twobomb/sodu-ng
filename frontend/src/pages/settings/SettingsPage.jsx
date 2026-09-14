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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Loader2,
    Settings,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Megaphone,
    Send,
    FileText,
    HardDrive,
} from 'lucide-react';
import FilesTab from './FilesTab';

// Нормализация: массив / {data: ...} / undefined
const unwrap = (v) => (v && v.data !== undefined ? v.data : v);

const SettingsPage = () => {
    const { data, isLoading, error } = useSettings();
    const updateSettings = useUpdateSettings();
    const sendBroadcast = useSendBroadcast();

    // ---- ТО ----
    const [maintenance, setMaintenance] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [maintenanceMessageType, setMaintenanceMessageType] = useState('info');

    // ---- Размер файла ----
    const [maxFileMb, setMaxFileMb] = useState(20);
    const [fileMessage, setFileMessage] = useState('');
    const [fileMessageType, setFileMessageType] = useState('info');

    // ---- Broadcast ----
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastText, setBroadcastText] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastMessageType, setBroadcastMessageType] = useState('info');

    useEffect(() => {
        const s = unwrap(data);
        if (s !== undefined) {
            setMaintenance(!!s.maintenance_mode);
            if (s.chat_max_file_size_mb !== undefined) {
                setMaxFileMb(Number(s.chat_max_file_size_mb) || 20);
            }
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
                    setMaintenanceMessage(err.response?.data?.error || 'Ошибка сохранения');
                },
            }
        );
    };

    const handleSaveMaxFile = () => {
        setFileMessage('');
        const value = Number(maxFileMb);
        if (!Number.isFinite(value) || value < 1 || value > 500) {
            setFileMessageType('error');
            setFileMessage('Значение должно быть от 1 до 500 МБ');
            return;
        }

        updateSettings.mutate(
            { chat_max_file_size_mb: value },
            {
                onSuccess: () => {
                    setFileMessageType('success');
                    setFileMessage(`Новый лимит: ${value} МБ`);
                    setTimeout(() => setFileMessage(''), 3000);
                },
                onError: (err) => {
                    setFileMessageType('error');
                    setFileMessage(err.response?.data?.error || 'Ошибка сохранения');
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
                    setBroadcastMessage('Сообщение отправлено всем пользователям.');
                    setTimeout(() => setBroadcastMessage(''), 4000);
                },
                onError: (err) => {
                    setBroadcastMessageType('error');
                    setBroadcastMessage(err.response?.data?.error || 'Ошибка отправки');
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
        <div className="space-y-4 max-w-5xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="h-6 w-6 text-orange-500" />
                    Конфигурация системы
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Раздел доступен только роли «Разработчик»
                </p>
            </div>

            <Tabs defaultValue="general">
                <TabsList className="bg-white shadow-sm rounded-xl p-1 inline-flex w-auto">
                    <TabsTrigger
                        value="general"
                        className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                    >
                        <Wrench className="h-4 w-4 mr-2" />
                        Основные
                    </TabsTrigger>
                    <TabsTrigger
                        value="files"
                        className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                    >
                        <HardDrive className="h-4 w-4 mr-2" />
                        Управление файлами
                    </TabsTrigger>
                </TabsList>

                {/* ============================================================ */}
                {/* Вкладка "Основные" */}
                {/* ============================================================ */}
                <TabsContent value="general" className="space-y-4 mt-4">
                    {/* Системное сообщение */}
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Megaphone className="h-5 w-5 text-orange-500" />
                                Системное сообщение
                            </CardTitle>
                            <CardDescription>
                                Отправить всплывающее сообщение всем активным пользователям.
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
                                        placeholder="Введите текст..."
                                        rows={5}
                                        maxLength={5000}
                                        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[100px]"
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

                    {/* Максимальный размер файла */}
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="h-5 w-5 text-orange-500" />
                                Максимальный размер файла в чате
                            </CardTitle>
                            <CardDescription>
                                Ограничение на один загружаемый файл. Применяется мгновенно.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={maxFileMb}
                                    onChange={(e) => setMaxFileMb(e.target.value)}
                                    className="rounded-lg w-32"
                                />
                                <span className="text-sm text-slate-600">МБ</span>
                                <Button
                                    onClick={handleSaveMaxFile}
                                    disabled={updateSettings.isPending}
                                    className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 ml-auto"
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
                            <p className="text-xs text-slate-400">
                                Допустимый диапазон: 1–500 МБ. Значение по умолчанию: 20 МБ.
                            </p>

                            {fileMessage && (
                                <div
                                    className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                                        fileMessageType === 'error'
                                            ? 'bg-red-50 text-red-600 border-red-200'
                                            : 'bg-green-50 text-green-700 border-green-200'
                                    }`}
                                >
                                    {fileMessageType !== 'error' && (
                                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    {fileMessage}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Техническое обслуживание */}
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Wrench className="h-5 w-5 text-orange-500" />
                                Техническое обслуживание
                            </CardTitle>
                            <CardDescription>
                                При включении все пользователи, кроме разработчиков, будут
                                отключены от системы и не смогут войти.
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
                                        Текущие сессии обычных пользователей будут завершены, и они
                                        не смогут войти до выключения режима.
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
                </TabsContent>

                {/* ============================================================ */}
                {/* Вкладка "Управление файлами" */}
                {/* ============================================================ */}
                <TabsContent value="files" className="mt-4">
                    <FilesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SettingsPage;