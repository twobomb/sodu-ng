import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
    for (const k of ['status', 'type', 'municipality', 'search', 'date_from', 'date_to', 'created_from', 'created_to', 'page', 'pageSize']) {
        if (filters[k] !== undefined && filters[k] !== '' && filters[k] !== null) {
            clean[k] = filters[k];
        }
    }
    return useQuery({
        queryKey: ['calls', clean],
        queryFn: () => api.getCalls(clean).then((r) => r.data),
        refetchOnWindowFocus: false,
        // keepPreviousData: держим данные последней успешной страницы/фильтра на
        // экране, пока грузится новая. Это важно и при смене queryKey (разные страницы):
        // placeholderData: (prev)=>prev здесь БЕСПОЛЕЗЕН, т.к. для нового ключа prev
        // отсутствует. без этого на время загрузки data становится undefined,
        // totalPages обнуляется до 1, кнопки блокируются и «откатывают» страницу назад.
        placeholderData: keepPreviousData,
    });
};

// ============================================================
// МОНИТОРИНГ: вызовы в обработке (реальное время)
// ============================================================
export const useMonitorCalls = () =>
    useQuery({
        queryKey: ['calls', 'monitor'],
        queryFn: () => api.getMonitorCalls().then((r) => r.data),
        refetchInterval: 10 * 1000,
        refetchIntervalInBackground: false,
        staleTime: 5 * 1000,
    });

// Округа, доступные текущему пользователю
export const useMunicipalities = () =>
    useQuery({
        queryKey: ['calls', 'municipalities'],
        queryFn: () => api.getMunicipalities().then((r) => r.data),
        staleTime: 60 * 1000,
    });

// ============================================================
// ОДИН ВЫЗОВ (карточка)
// ============================================================
export const useCall = (id) =>
    useQuery({
        queryKey: ['call', id],
        queryFn: () => api.getCall(id).then((r) => r.data),
        enabled: !!id,
        refetchOnWindowFocus: false,
        // Карточка вызова должна всегда показывать свежие данные с сервера при
        // открытии. Глобально refetchOnMount:false (см. App.jsx), из-за чего после
        // смены статуса/привязки техники из других страниц открытая карточка
        // показывала устаревший кеш до перезагрузки страницы.
        refetchOnMount: 'always',
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

// ============================================================
// ПРИВЯЗКА ПОДРАЗДЕЛЕНИЙ К ВЫЗОВУ (доступ/видимость)
// ============================================================
export const useCallDepartments = (id) =>
    useQuery({
        queryKey: ['call-departments', id],
        queryFn: () => api.getCallDepartments(id).then((r) => r.data),
        enabled: !!id,
        staleTime: 30 * 1000,
    });

export const useSetCallDepartments = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, departmentIds }) => api.setCallDepartments(id, departmentIds),
        onSuccess: (res, vars) => {
            qc.invalidateQueries(['call-departments', vars.id]);
            invalidateCalls(qc);
        },
    });
};