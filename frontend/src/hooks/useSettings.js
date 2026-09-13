import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getSettings,
    updateSettings,
    getPublicSettings,
    sendBroadcast,
} from '../api/settings';


export const useSettings = () =>
    useQuery({ queryKey: ['settings'], queryFn: getSettings });

export const useUpdateSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateSettings,
        onSuccess: () => {
            qc.invalidateQueries(['settings']);
            qc.invalidateQueries(['publicSettings']);
        },
    });
};

/**
 * Живой broadcast — данные приходят ТОЛЬКО через socket.
 * queryFn возвращает null, потому что сервер не хранит последнее сообщение.
 * useQuery просто служит мостом между кешем и React-перерисовкой.
 */
export const useLiveBroadcast = () =>
    useQuery({
        queryKey: ['broadcast', 'live'],
        queryFn: () => null,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
// Публичные настройки — опрашиваются периодически
export const usePublicSettings = () =>
    useQuery({
        queryKey: ['publicSettings'],
        queryFn: getPublicSettings,
        refetchInterval: 30000,   // раз в 30 сек
        staleTime: 10000,
    });


export const useSendBroadcast = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: sendBroadcast,
        onSuccess: () => {
            qc.invalidateQueries(['broadcast', 'latest']);
        },
    });
};