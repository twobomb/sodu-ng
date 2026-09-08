import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useSocket = () => {
    const { user } = useAuth();
    const socketRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !user) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [user]);

    return socketRef.current;
};