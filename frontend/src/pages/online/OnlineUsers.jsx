import { useState, useMemo } from 'react';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Users, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const roleLabels = {
    developer: 'Разработчик',
    admin: 'Администратор',
    dispatcher: 'Диспетчер',
    viewer: 'Наблюдатель',
};

const OnlineUsers = () => {
    const { data, isLoading, error } = useOnlineUsers();
    const [searchTerm, setSearchTerm] = useState('');

    const users = data?.data || [];

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;
        const term = searchTerm.toLowerCase();
        return users.filter((user) =>
            user.username.toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-slate-400">Загрузка онлайн-пользователей...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки онлайн-пользователей
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Онлайн</h2>
                    <p className="text-sm text-slate-500">
                        {users.length} пользователей в сети
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по имени пользователя..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
            </div>

            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>
                        {searchTerm ? 'Пользователи не найдены' : 'Нет пользователей в сети'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-orange-100 text-orange-600">
                                            {user.username.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-slate-800">{user.username}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Badge variant="outline" className="text-xs">
                                                {roleLabels[user.role] || user.role}
                                            </Badge>
                                            <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                                                {user.last_active_at
                                                    ? formatDistanceToNow(new Date(user.last_active_at), {
                                                        addSuffix: true,
                                                        locale: ru,
                                                    })
                                                    : 'недавно'}
                      </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                                    <span className="text-sm text-green-600">в сети</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnlineUsers;