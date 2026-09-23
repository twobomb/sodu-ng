import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getSettings,
    updateSettings,
    getPublicSettings,
    getDiskInfo,
    getSoduSettings,
    updateSoduSettings,
    sendBroadcast,
    getAdminFiles,
    getFolderSize,
    deleteAdminFiles,
} from '../api/settings';


// ============================================================
// Файлы (только developer)
// ============================================================
export const useAdminFiles = () =>
    useQuery({
        queryKey: ['admin-files'],
        queryFn: () => getAdminFiles().then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useFolderSize = () =>
    useQuery({
        queryKey: ['admin-folder-size'],
        queryFn: () => getFolderSize().then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useDeleteAdminFiles = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteAdminFiles,
        onSuccess: () => {
            qc.invalidateQueries(['admin-files']);
            qc.invalidateQueries(['admin-folder-size']);
        },
    });
};
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

// Информация о разделе, где хранится папка uploads (только developer)
export const useDiskInfo = () =>
    useQuery({
        queryKey: ['settings-disk'],
        queryFn: () => getDiskInfo().then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });

// Настройки СОДУ — глобальные, применяются ко всем пользователям
export const useSoduSettings = () =>
    useQuery({
        queryKey: ['soduSettings'],
        queryFn: () => getSoduSettings().then((r) => r.data),
        staleTime: 15 * 1000,
    });

export const useUpdateSoduSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateSoduSettings,
        onSuccess: () => {
            qc.invalidateQueries(['soduSettings']);
            qc.invalidateQueries(['settings']);
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