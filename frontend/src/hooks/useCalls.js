import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/calls';

// Инвалидирует кэши списков и карточек вызовов
const invalidateCalls = (queryClient) =>
    queryClient.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey[0];
            return key === 'calls' || key === 'call';
        },
    });

// ============================================================
// СПИСОК + ФИЛЬТРЫ
// ============================================================
export const useCalls = (filters = {}) => {
    const clean = {};
    for (const k of ['status', 'type', 'search', 'date_from', 'date_to']) {
        if (filters[k]) clean[k] = filters[k];
    }
    return useQuery({
        queryKey: ['calls', clean],
        queryFn: () => api.getCalls(clean).then((r) => r.data),
        refetchOnWindowFocus: true,
    });
};

// ============================================================
// ОДИН ВЫЗОВ (карточка)
// ============================================================
export const useCall = (id) =>
    useQuery({
        queryKey: ['call', id],
        queryFn: () => api.getCall(id).then((r) => r.data),
        enabled: !!id,
        refetchOnWindowFocus: true,
    });

// ============================================================
// МУТАЦИИ
// ============================================================
export const useCreateCall = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createCall,
        onSuccess: () => invalidateCalls(qc),
    });
};

export const useUpdateCall = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateCall(id, data),
        onSuccess: () => invalidateCalls(qc),
    });
};

export const useSetCallStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }) => api.setCallStatus(id, status),
        onSuccess: () => invalidateCalls(qc),
    });
};

export const useSetCallUnits = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, unitIds }) => api.setCallUnits(id, unitIds),
        onSuccess: () => invalidateCalls(qc),
    });
};

export const useAddCallEvent = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.addCallEvent(id, data),
        onSuccess: () => invalidateCalls(qc),
    });
};

export const useDeleteCallEvent = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, eventId }) => api.deleteCallEvent(id, eventId),
        onSuccess: () => invalidateCalls(qc),
    });
};