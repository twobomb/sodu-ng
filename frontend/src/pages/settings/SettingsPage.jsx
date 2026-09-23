import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { Settings, Wrench, HardDrive } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import SystemTab from './SystemTab';
import FilesTab from './FilesTab';

const SettingsPage = () => {
    const { isDeveloper, has } = usePermissions();

    // «Системные» — только для разработчика
    const showSystem = isDeveloper;
    // «Управление файлами» — по правилу доступа
    const showFiles = has('settings.files');

    if (!showSystem && !showFiles) {
        return (
            <div className="space-y-4 max-w-5xl">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="h-6 w-6 text-orange-500" />
                        Настройки
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        У вас нет доступа к доступным разделам настроек.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-5xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="h-6 w-6 text-orange-500" />
                    Настройки
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Системные настройки и управление файлами
                </p>
            </div>

            <Tabs defaultValue={showSystem ? 'system' : 'files'}>
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
            </Tabs>
        </div>
    );
};

export default SettingsPage;