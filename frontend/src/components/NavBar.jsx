import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Flame,
    Siren,
    Truck,
    ChevronDown,
    LogOut,
    List,
    Activity,
    Shield,
    Building2,
    MapPin,
    ShieldCheck,
    Building,
    HelpCircle,
    Settings as SettingsIcon,
    MessageCircle,
    LayoutGrid,
    FolderTree,
    Ban,
    Moon,
    Sun,
    FileText,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { usePermissions } from '../hooks/usePermissions';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useChatUnreadCounts } from '../hooks/useChat';

const NavBar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { has } = usePermissions();
    const unread = useChatUnreadCounts();
    const { data: onlineUsers = [] } = useOnlineUsers();
    const onlineCount = Array.isArray(onlineUsers) ? onlineUsers.length : 0;
    const { setTheme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';


    const isActive = (path) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

    const isUsersSection =
        isActive('/users') || isActive('/online') || isActive('/roles');

    // Пункт "Дополнительно" активен на страницах разделов
    const isAdditionalSection =
        isUsersSection ||
        isActive('/departments') ||
        isActive('/municipalities') ||
        isActive('/department-types') ||
        isActive('/garrisons') ||
        isActive('/dictionaries') ||
        isActive('/unit-types');

    // Пункт "Мониторинг" активен на страницах мониторинга
    const isMonitoringSection =
        isActive('/calls-monitor') || isActive('/units-grid');

    // Пункт "Отчёты" активен на страницах отчётов
    const isReportsSection = isActive('/reports');

    return (
        <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-white/10 sticky top-0 z-40 navMenu">
            <div className="px-8 shadow-[1px_14px_20px_1px_#0000001a]">
                <div className="flex items-center justify-between h-16">
                    {/* Логотип */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                            <Flame className="h-6 w-6 text-white" />
                        </div>
                        <div>
              <span className="text-xl font-bold text-slate-800 tracking-tight">
                СОДУ
              </span>
                            <p className="text-[10px] text-slate-400 -mt-1 font-medium tracking-wide">
                                ДИСПЕТЧЕРСКАЯ СИСТЕМА
                            </p>
                        </div>
                    </Link>

                    {/* Меню */}
                    <div className="flex items-center gap-1">
                        {has('calls.view') && (
                            <Button
                                variant="ghost"
                                onClick={() => navigate('/calls')}
                                className={`rounded-lg transition-all ${
                                    isActive('/calls')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Siren className="h-4 w-4 mr-2" />
                                Вызовы
                            </Button>
                        )}

                        {has('units.view') && (
                            <Button
                                variant="ghost"
                                onClick={() => navigate('/units')}
                                className={`rounded-lg transition-all ${
                                    isActive('/units')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Truck className="h-4 w-4 mr-2" />
                                Техника
                            </Button>
                        )}

                        {(has('calls.view') || has('units.view')) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={`rounded-lg transition-all ${
                                            isMonitoringSection
                                                ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Activity className="h-4 w-4 mr-2" />
                                        Мониторинг
                                        <ChevronDown
                                            className={`h-3 w-3 ml-1 transition-transform ${
                                                isMonitoringSection ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {has('calls.view') && (
                                        <DropdownMenuItem
                                            icon={Activity}
                                            onClick={() => navigate('/calls-monitor')}
                                        >
                                            Мониторинг вызовов
                                        </DropdownMenuItem>
                                    )}
                                    {has('units.view') && (
                                        <>
                                            {has('calls.view') && (
                                                <DropdownMenuSeparator />
                                            )}
                                            <DropdownMenuItem
                                                icon={LayoutGrid}
                                                onClick={() => navigate('/units-grid')}
                                            >
                                                Мониторинг техники
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {(has('users.view') ||
                            has('users.view_online') ||
                            has('roles.view') ||
                            has('departments.view') ||
                            has('units.view') ||
                            has('calls.view') ||
                            has('dictionaries.manage')) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={`rounded-lg transition-all ${
                                            isAdditionalSection
                                                ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <LayoutGrid className="h-4 w-4 mr-2" />
                                        Дополнительно
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {(has('users.view') ||
                                        has('users.view_online') ||
                                        has('roles.view')) && (
                                        <>
                                            <DropdownMenuLabel>Пользователи</DropdownMenuLabel>
                                            {has('users.view') && (
                                                <DropdownMenuItem icon={List} onClick={() => navigate('/users')}>
                                                    Список пользователей
                                                </DropdownMenuItem>
                                            )}
                                            {has('users.view_online') && (
                                                <DropdownMenuItem icon={Activity} onClick={() => navigate('/online')}>
                                                    Онлайн пользователи
                                                </DropdownMenuItem>
                                            )}
                                            {has('roles.view') && (
                                                <DropdownMenuItem icon={Shield} onClick={() => navigate('/roles')}>
                                                    Роли
                                                </DropdownMenuItem>
                                            )}
                                        </>
                                    )}
                                    {has('departments.view') && (
                                        <>
                                            <DropdownMenuLabel>Структура</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                icon={Building2}
                                                onClick={() => navigate('/departments')}
                                            >
                                                Подразделения
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                icon={MapPin}
                                                onClick={() => navigate('/municipalities')}
                                            >
                                                Округа
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                icon={ShieldCheck}
                                                onClick={() => navigate('/department-types')}
                                            >
                                                Виды подразделений
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                icon={Building}
                                                onClick={() => navigate('/garrisons')}
                                            >
                                                Гарнизоны
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {(has('calls.view') ||
                                        has('dictionaries.manage') ||
                                        has('units.view')) && (
                                        <>
                                            <DropdownMenuLabel>Справочники</DropdownMenuLabel>
                                            <DropdownMenuItem icon={FolderTree} onClick={() => navigate('/dictionaries/fire-categories')}>
                                                Категории пожаров
                                            </DropdownMenuItem>
                                            <DropdownMenuItem icon={Flame} onClick={() => navigate('/dictionaries/fire-causes')}>
                                                Причины пожаров
                                            </DropdownMenuItem>
                                            <DropdownMenuItem icon={Ban} onClick={() => navigate('/dictionaries/fire-nonaccount')}>
                                                Пожар не подлежит учёту — причины
                                            </DropdownMenuItem>
                                            {has('units.view') && (
                                                <DropdownMenuItem icon={Truck} onClick={() => navigate('/unit-types')}>
                                                    Типы техники
                                                </DropdownMenuItem>
                                            )}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {has('line_notes.view') && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={`rounded-lg transition-all ${
                                            isReportsSection
                                                ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Отчёты
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem
                                        icon={FileText}
                                        onClick={() => navigate('/reports/line-notes')}
                                    >
                                        Строевая записка
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <Link to="/help">
                            <Button
                                variant="ghost"
                                className={`rounded-lg transition-all ${
                                    isActive('/help')
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 hover:from-orange-100 hover:to-red-100 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300 dark:hover:from-orange-500/30 dark:hover:to-red-500/30'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <HelpCircle className="h-4 w-4 mr-2" />
                                Справка
                            </Button>
                        </Link>
                    </div>

                    <Link to="/online" title="Онлайн-пользователи">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 hover:bg-green-100 dark:hover:bg-green-500/20 hover:border-green-300 dark:hover:border-green-500/40 transition-colors cursor-pointer">
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
    </span>
                            <span className="text-sm font-semibold text-green-700 tabular-nums">
      {onlineCount}
    </span>
                        </div>
                    </Link>
                    {/* Пользователь и выход */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-700">
                                {user?.username}
                            </p>
                            <p className="text-xs text-slate-400">
                                {user?.role_name || user?.role}
                            </p>
                        </div>

                        {has('chat.use') && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    window.dispatchEvent(new CustomEvent('chat:toggle'))
                                }
                                className="rounded-lg border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 relative"
                                title="Чат"
                            >
                                <MessageCircle className="h-4 w-4" />
                                {unread.total > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unread.total > 99 ? '99+' : unread.total}
                  </span>
                                )}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                            className="relative rounded-lg border-slate-200 dark:border-white/15 hover:bg-orange-50 dark:hover:bg-white/10 hover:text-orange-600 dark:hover:text-orange-400"
                            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
                            aria-label="Переключить тему"
                        >
                            <Moon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Sun className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        </Button>
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