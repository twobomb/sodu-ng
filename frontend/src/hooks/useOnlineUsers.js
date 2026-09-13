import { useQuery } from '@tanstack/react-query';
import { getOnlineUsers } from '../api/online';

/**
 * Список онлайн-пользователей.
 *  - REST-запрос каждые 30 сек — гарантия, что счётчик не залипнет.
 *  - Socket-событие 'online_users' (в useSocket.js) мгновенно перезаписывает
 *    кеш через queryClient.setQueryData — для реактивности.
 *  - Никаких своих socket-подключений.
 */
export const useOnlineUsers = () =>
    useQuery({
        queryKey: ['onlineUsers'],
        queryFn: () => getOnlineUsers().then((r) => r.data),
        staleTime: 25 * 1000,
        refetchInterval: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });