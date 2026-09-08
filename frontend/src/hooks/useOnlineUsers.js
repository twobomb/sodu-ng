import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOnlineUsers } from '../api/online';
import { useEffect } from 'react';
import { useSocket } from './useSocket';

export const useOnlineUsers = () => {
    const queryClient = useQueryClient();
    const socket = useSocket();

    const query = useQuery({
        queryKey: ['onlineUsers'],
        queryFn: getOnlineUsers,
        refetchInterval: 30000, // обновлять каждые 30 секунд на всякий случай
    });

    // Подписка на обновления через Socket.IO
    useEffect(() => {
        if (!socket) return;

        const handleOnlineUsers = (users) => {
            queryClient.setQueryData(['onlineUsers'], { data: users });
        };

        socket.on('online_users', handleOnlineUsers);

        return () => {
            socket.off('online_users', handleOnlineUsers);
        };
    }, [socket, queryClient]);

    return query;
};