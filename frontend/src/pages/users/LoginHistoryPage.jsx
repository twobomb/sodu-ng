import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useLoginHistory } from '../../hooks/useLoginHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    History,
    Search,
    ArrowLeft,
    ArrowRight,
    Lock,
    Users,
} from 'lucide-react';

const PAGE_SIZE = 25;

const LoginHistoryPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const userId = searchParams.get('userId') || null;
    const userName = searchParams.get('name') || null;
    const search = searchParams.get('search') || '';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);

    const [searchInput, setSearchInput] = useState(search);

    const offset = (page - 1) * PAGE_SIZE;
    const { data, isLoading, error } = useLoginHistory({
        userId,
        search,
        limit: PAGE_SIZE,
        offset,
    });

    const total = data?.total || 0;
    const items = data?.items || [];
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    // Пересобрать URL, сохраняя фильтр по пользователю.
    const apply = ({ search: nextSearch, page: nextPage }) => {
        const sp = new URLSearchParams();
        if (userId) sp.set('userId', userId);
        if (userName) sp.set('name', userName);
        if (nextSearch) sp.set('search', nextSearch);
        if (nextPage > 1) sp.set('page', String(nextPage));
        const qs = sp.toString();
        navigate(qs ? `/login-history?${qs}` : '/login-history');
    };

    const handleSearch = (e) => {
        e.preventDefault();
        apply({ search: searchInput.trim(), page: 1 });
    };

    const handleClearSearch = () => {
        setSearchInput('');
        apply({ search: '', page: 1 });
    };

    const showAll = () => navigate('/login-history');

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <History className="h-6 w-6 text-orange-500" />
                        История входов
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Время, пользователь и IP-адрес при авторизации
                    </p>
                </div>
            </div>
{/* Фильтр по пользователю (при переходе со списка пользователей) */}
            {userId && (
                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl px-4 py-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm text-orange-700">
                        <Users className="h-4 w-4" />
                        Показана история входов пользователя:{' '}
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30">
                            {userName || userId}
                        </Badge>
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={showAll}
                        className="rounded-lg"
                    >
                        Показать всех
                    </Button>
                </div>
            )}

            {/* Поиск по пользователю */}
            <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Поиск по имени пользователя..."
                            className="h-10 pl-10 rounded-lg"
                        />
                    </div>
                    <Button type="submit" className="h-10 rounded-lg">
                        Найти
                    </Button>
                    {search && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClearSearch}
                            className="h-10 rounded-lg"
                        >
                            Сбросить
                        </Button>
                    )}
                    {!search && userId && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={showAll}
                            className="h-10 rounded-lg"
                        >
                            Все пользователи
                        </Button>
                    )}
                </div>
            </form>
{isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-pulse flex flex-col items-center gap-2">
                        <History className="h-8 w-8 text-slate-300" />
                        <p className="text-slate-400">Загрузка истории входов...</p>
                    </div>
                </div>
            ) : error ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-red-600">
                    Не удалось загрузить историю входов.
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <History className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Записей о входах не найдено</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата и время</TableHead>
                                <TableHead>Пользователь</TableHead>
                                <TableHead>IP-адрес</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium tabular-nums whitespace-nowrap">
                                        {format(new Date(row.created_at), 'dd.MM.yyyy HH:mm:ss', {
                                            locale: ru,
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5 text-slate-400" />
                                            {row.username}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1.5 font-mono text-sm text-slate-600">
                                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                                            {row.ip || '—'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Пагинация */}
            {!isLoading && !error && total > PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">Записей: {total}</p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => apply({ search, page: page - 1 })}
                            className="h-8 rounded-lg"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Назад
                        </Button>
                        <span className="text-sm text-slate-600 tabular-nums">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => apply({ search, page: page + 1 })}
                            className="h-8 rounded-lg"
                        >
                            Вперёд
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginHistoryPage;