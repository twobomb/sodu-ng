import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

/**
 * Периодически проверяет доступность сервера через /api/health,
 * а также реагирует на события online/offline браузера.
 * Возвращает true, когда соединение с сервером потеряно.
 */
export const useServerAvailability = (intervalMs = 5000) => {
    const [offline, setOffline] = useState(false);
    const checkingRef = useRef(false);

    useEffect(() => {
        let timer;

        const check = async () => {
            if (checkingRef.current) return;
            checkingRef.current = true;
            let ok;
            try {
                await apiClient.get('/health', { timeout: 8000 });
                ok = true;
            } catch {
                ok = false;
            } finally {
                checkingRef.current = false;
            }
            setOffline(!ok);
        };

        const handleOnline = () => setOffline(false);
        const handleOffline = () => setOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        check();
        timer = setInterval(check, intervalMs);

        return () => {
            clearInterval(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [intervalMs]);

    return offline;
};