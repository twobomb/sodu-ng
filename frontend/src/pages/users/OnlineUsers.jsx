import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoles } from '../../hooks/useRoles.js';
import { Input } from '@/components/ui/input.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.tsx';
import { Search, Users, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const OnlineUsers = () => {
    const [searchTerm, setSearchTerm] = useState('');

    // Данные приходят по socket (событие online_users).
    // Пока сокет не прислал первый список — берём из кеша (по умолчанию пустой массив).
    const { data: onlineUsers = [], isLoading } = useQuery({
        queryKey: ['onlineUsers'],
        queryFn: () => [],         // фолбэк — не делаем REST-запрос
        staleTime: Infinity,       // не перезапрашивать
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // Роли грузим динамически — чтобы работали созданные вручную роли
    const { data: rolesData } = useRoles();
    const roles = rolesData?.data || [];
    const roleMap = useMemo(
        () => roles.reduce((acc, r) => { acc[r.code] = r.name; return acc; }, {}),
        [roles]
    );

    const users = Array.isArray(onlineUsers) ? onlineUsers : [];

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;
        const term = searchTerm.toLowerCase();
        return users.filter((u) => u.username.toLowerCase().includes(term));
    }, [users, searchTerm]);

    if (isLoading && users.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-slate-400">Загрузка онлайн-пользователей...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Онлайн</h2>
                    <p className="text-sm text-slate-500">
                        {users.length}{' '}
                        {users.length === 1
                            ? 'пользователь в сети'
                            : users.length >= 2 && users.length <= 4
                                ? 'пользователя в сети'
                                : 'пользователей в сети'}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
                    <span className="text-xs font-medium text-green-700">
            Обновляется в реальном времени
          </span>
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
                        {searchTerm
                            ? 'Пользователи не найдены'
                            : 'Нет пользователей в сети'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback className="bg-orange-100 text-orange-600">
                                                {user.username.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{user.username}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Badge variant="outline" className="text-xs">
                                                {roleMap[user.role] || user.role_name || user.role}
                                            </Badge>
                                            <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                                                {user.last_active_at
                                                    ? formatDistanceToNow(new Date(user.last_active_at), {
                                                        addSuffix: true,
                                                        locale: ru,
                                                    })
                                                    : 'только что'}
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