import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Settings,
    Settings2,
    Wrench,
    HardDrive,
    Volume2,
    MessageSquareMore,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import SystemTab from './SystemTab';
import FilesTab from './FilesTab';
import SoundsTab from './SoundsTab';
import SoduTab from './SoduTab';

const SettingsPage = () => {
    const { isDeveloper, has } = usePermissions();

    // «Системные» — только для разработчика
    const showSystem = isDeveloper;
    // «Управление файлами» — по правилу доступа
    const showFiles = has('settings.files');
    // «Звуки» — доступны всем пользователям
    const showSounds = true;
    // «Настройки чата» — только если есть доступ к чату
    const showChatSettings = has('chat.use');
    // «Настройки СОДУ» — только по праву sodu.settings
    const showSodu = has('sodu.settings');

    const defaultTab = showSystem
        ? 'system'
        : showFiles
            ? 'files'
            : showSodu
                ? 'sodu'
                : 'sounds';

    // Открыть чат сразу на странице настроек в чате
    const openChatSettings = () =>
        window.dispatchEvent(new CustomEvent('chat:open-settings'));

    return (
        <div className="space-y-4 max-w-5xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="h-6 w-6 text-orange-500" />
                    Настройки
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Системные настройки, управление файлами и звуки
                </p>
            </div>

            <Tabs defaultValue={defaultTab}>
                <TabsList className="bg-white shadow-sm rounded-xl p-1 inline-flex w-auto">
                    {showSystem && (
                        <TabsTrigger
                            value="system"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                        >
                            <Wrench className="h-4 w-4 mr-2" />
                            Системные
                        </TabsTrigger>
                    )}
                    {showFiles && (
                        <TabsTrigger
                            value="files"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                        >
                            <HardDrive className="h-4 w-4 mr-2" />
                            Управление файлами
                        </TabsTrigger>
                    )}
                    {showSounds && (
                        <TabsTrigger
                            value="sounds"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                        >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Звуки
                        </TabsTrigger>
                    )}
                    {showChatSettings && (
                        <TabsTrigger
                            value="chat-settings"
                            onClick={openChatSettings}
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                        >
                            <Settings2 className="h-4 w-4 mr-2" />
                            Настройки чата
                        </TabsTrigger>
                    )}
                    {showSodu && (
                        <TabsTrigger
                            value="sodu"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
                        >
                            <Settings2 className="h-4 w-4 mr-2" />
                            Настройки СОДУ
                        </TabsTrigger>
                    )}
                </TabsList>

                {showSystem && (
                    <TabsContent value="system" className="mt-4">
                        <SystemTab />
                    </TabsContent>
                )}

                {showFiles && (
                    <TabsContent value="files" className="mt-4">
                        <FilesTab />
                    </TabsContent>
                )}

                {showSounds && (
                    <TabsContent value="sounds" className="mt-4">
                        <SoundsTab />
                    </TabsContent>
                )}

                {showChatSettings && (
                    <TabsContent value="chat-settings" className="mt-4">
                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Settings2 className="h-5 w-5 text-orange-500" />
                                    Настройки чата
                                </CardTitle>
                                <CardDescription>
                                    Откроется чат со страницей настроек.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={openChatSettings}
                                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg gap-2"
                                >
                                    <MessageSquareMore className="h-4 w-4" />
                                    Открыть настройки чата
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {showSodu && (
                    <TabsContent value="sodu" className="mt-4">
                        <SoduTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default SettingsPage;