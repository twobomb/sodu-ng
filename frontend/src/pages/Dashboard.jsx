import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Flame, Truck, Users } from 'lucide-react';
import FiresList from './fires/FiresList';
import UnitsList from './units/UnitsList';
import OnlineUsers from './online/OnlineUsers';

const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <div className="px-8 py-6 max-w-full">
                {/* Шапка */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Flame className="h-8 w-8 text-orange-500" />
                            СОДУ
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Система оперативного диспетчерского управления
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-700">{user?.username}</p>
                            <p className="text-xs text-slate-400">{user?.role}</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={logout}
                            className="rounded-lg border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Выйти
                        </Button>
                    </div>
                </div>

                {/* Вкладки (меню) */}
                <Tabs defaultValue="fires" className="space-y-4">
                    <TabsList className="bg-white shadow-sm rounded-xl p-1 flex w-full gap-1">
                        <TabsTrigger
                            value="fires"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4 py-2 flex items-center"
                        >
                            <Flame className="h-4 w-4 mr-2" />
                            Пожары
                        </TabsTrigger>
                        <TabsTrigger
                            value="units"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4 py-2 flex items-center"
                        >
                            <Truck className="h-4 w-4 mr-2" />
                            Техника
                        </TabsTrigger>
                        <TabsTrigger
                            value="online"
                            className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4 py-2 flex items-center"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Онлайн
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="fires">
                        <FiresList />
                    </TabsContent>

                    <TabsContent value="units">
                        <UnitsList />
                    </TabsContent>
                    <TabsContent value="online">
                            <OnlineUsers />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Dashboard;