import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, getPublicSettings } from '../api/settings';

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

// Публичные настройки — опрашиваются периодически
export const usePublicSettings = () =>
    useQuery({
        queryKey: ['publicSettings'],
        queryFn: getPublicSettings,
        refetchInterval: 30000,   // раз в 30 сек
        staleTime: 10000,
    });