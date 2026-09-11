import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL =
    import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useSocket = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const socketRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !user) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket подключён');
        });

        socket.on('connect_error', (err) => {
            console.warn('Socket ошибка подключения:', err.message);
        });

        // Любое изменение данных (CRUD) — инвалидируем весь кеш
        socket.on('force_refresh', () => {
            queryClient.invalidateQueries();
        });

        // Онлайн-пользователи (список из памяти сокетов на бэке)
        socket.on('online_users', (users) => {
            queryClient.setQueryData(['onlineUsers'], users);
        });

        // Пользователь заблокирован или включён режим ТО
        socket.on('force_logout', (payload) => {
            const reason = payload?.reason || 'blocked';
            sessionStorage.setItem('logout_reason', reason);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
        socket.on('session_replaced', (payload) => {
            // Помечаем причину выхода, чтобы показать её на странице логина
            sessionStorage.setItem(
                'logout_reason',
                'session_replaced'
            );
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
        // Режим ТО включён
        socket.on('maintenance_mode_on', () => {
            queryClient.invalidateQueries(['publicSettings']);
        });

        // Режим ТО выключен
        socket.on('maintenance_mode_off', () => {
            queryClient.invalidateQueries(['publicSettings']);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user, queryClient]);

    return socketRef.current;
};