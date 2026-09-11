import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Truck, Users, ChevronDown, LogOut, List, Activity, Shield,Building2,SettingsIcon } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { usePermissions } from '../hooks/usePermissions';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const NavBar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { has } = usePermissions();
    const isActive = (path) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

    const isUsersSection = isActive('/users') || isActive('/online') || isActive('/roles');

    return (
        <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-40 navMenu">
            <div className="px-8 shadow-[1px_14px_20px_1px_#0000001a]" >
                <div className="flex items-center justify-between h-16">
                    {/* Логотип */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                            <Flame className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-xl font-bold text-slate-800 tracking-tight">СОДУ</span>
                            <p className="text-[10px] text-slate-400 -mt-1 font-medium tracking-wide">
                                ДИСПЕТЧЕРСКАЯ СИСТЕМА
                            </p>
                        </div>
                    </Link>

                    {/* Меню */}
                    <div className="flex items-center gap-1">
                        {has('fires.view') && (
                        <Link to="/fires">
                            <Button
                                variant="ghost"
                                className={`rounded-lg transition-all ${
                                    isActive('/fires')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Flame className="h-4 w-4 mr-2" />
                                Пожары
                            </Button>
                        </Link>
                        )}
                        {has('units.view') && (
                        <Link to="/units">
                            <Button
                                variant="ghost"
                                className={`rounded-lg transition-all ${
                                    isActive('/units')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Truck className="h-4 w-4 mr-2" />
                                Техника
                            </Button>
                        </Link>
                        )}

                        {has('users.view') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={`rounded-lg transition-all ${
                                        isUsersSection
                                            ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Users className="h-4 w-4 mr-2" />
                                    Пользователи
                                    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isUsersSection ? 'rotate-180' : ''}`} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                    icon={List}
                                    onClick={() => navigate('/users')}
                                >
                                    Список пользователей
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    icon={Activity}
                                    onClick={() => navigate('/online')}
                                >
                                    Онлайн пользователи
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    icon={Shield}
                                    onClick={() => navigate('/roles')}
                                >
                                    Роли
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        )}
                        {has('departments.view') && (

                        <Link to="/departments">
                            <Button
                                variant="ghost"
                                className={`rounded-lg transition-all ${
                                    isActive('/departments')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Building2 className="h-4 w-4 mr-2" />
                                Подразделения
                            </Button>
                        </Link>
                       )}
                    </div>

                    {/* Пользователь и выход */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-700">{user?.username}</p>
                            <p className="text-xs text-slate-400">{user?.role_name || user?.role}</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={logout}
                            className="rounded-lg border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Выйти
                        </Button>
                        {user?.role === 'developer' && (
                            <Link to="/settings" title="Конфигурация системы">
                                <Button
                                    variant="outline"
                                    className="rounded-lg border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200"
                                >
                                    <SettingsIcon className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;