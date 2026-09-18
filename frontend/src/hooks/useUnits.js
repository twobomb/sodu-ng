import { useQuery, useMutation, useQueryClient ,
    useInfiniteQuery} from '@tanstack/react-query';
import * as api from '../api/units';

// ============================================================
// ТЕХНИКА
// ============================================================
export const useUnits = () =>
    useQuery({
        queryKey: ['units'],
        queryFn: () => api.getUnits().then((r) => r.data),   // ← уже .data
    });
export const useUnit = (unitId, options = {}) =>
    useQuery({
        queryKey: ['unit', unitId],
        queryFn: () => api.getUnit(unitId).then((r) => r.data),
        enabled: !!unitId && options.enabled !== false,
        staleTime: 30 * 1000,
    });
export const useCreateUnit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createUnit,
        onSuccess: () => {
            queryClient.invalidateQueries(['units']);
            queryClient.invalidateQueries(['units-grid']);
        },
    });
};

export const useUpdateUnit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateUnit(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['units']);
            queryClient.invalidateQueries(['units-grid']);
        },
    });
};

export const useDeleteUnit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteUnit,
        onSuccess: () => {
            queryClient.invalidateQueries(['units']);
            queryClient.invalidateQueries(['units-grid']);
        },
    });
};

// ============================================================
// ТИПЫ ТЕХНИКИ
// ============================================================
export const useUnitTypes = () =>
    useQuery({
        queryKey: ['unit-types'],
        queryFn: () => api.getUnitTypes().then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });

export const useCreateUnitType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createUnitType,
        onSuccess: () => qc.invalidateQueries(['unit-types']),
    });
};

export const useUpdateUnitType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateUnitType(id, data),
        onSuccess: () => {
            qc.invalidateQueries(['unit-types']);
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};

export const useDeleteUnitType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deleteUnitType,
        onSuccess: () => {
            qc.invalidateQueries(['unit-types']);
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};

// ============================================================
// СТАТУСЫ ТЕХНИКИ
// ============================================================
export const useUnitStatuses = () =>
    useQuery({
        queryKey: ['unit-statuses'],
        queryFn: () => api.getUnitStatuses().then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });

export const useCreateUnitStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createUnitStatus,
        onSuccess: () => qc.invalidateQueries(['unit-statuses']),
    });
};

export const useUpdateUnitStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateUnitStatus(id, data),
        onSuccess: () => {
            qc.invalidateQueries(['unit-statuses']);
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};

export const useDeleteUnitStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deleteUnitStatus,
        onSuccess: () => {
            qc.invalidateQueries(['unit-statuses']);
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};

// ============================================================
// СМЕНА СТАТУСА ТЕХНИКИ
// ============================================================
export const useChangeUnitStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.changeUnitStatus(id, data),
        onSuccess: () => {
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
            qc.invalidateQueries(['unit-history']);
            qc.invalidateQueries(['units-history-global']);
            qc.invalidateQueries(['units-calls-available']);
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'call' || q.queryKey[0] === 'calls' });
        },
    });
};

// Доступные вызовы для привязки техники
export const useAvailableCalls = () =>
    useQuery({
        queryKey: ['units-calls-available'],
        queryFn: () => api.getAvailableCalls().then((r) => r.data),
        staleTime: 30 * 1000,
    });

// Показатели техники (топливо/пена/порошок/пробег)
export const useUpdateUnitMetrics = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateUnitMetrics(id, data),
        onSuccess: () => {
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
            qc.invalidateQueries(['unit', undefined]);
        },
    });
};

// Переупорядочивание техники внутри подразделения
export const useReorderUnits = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (unitIds) => api.reorderUnits(unitIds),
        onSuccess: () => {
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};

// ============================================================
// ИСТОРИЯ ПОКАЗАТЕЛЕЙ (топливо/пена/порошок/пробег)
// ============================================================
export const useUnitMetricsHistory = (unitId, metric, enabled = true) =>
    useQuery({
        queryKey: ['unit-metrics-history', unitId, metric],
        queryFn: () => api.getUnitMetricsHistory(unitId, metric).then((r) => r.data),
        enabled: !!unitId && !!metric && enabled,
        staleTime: 10 * 1000,
    });

// ============================================================
// СЕТКА ВСЕЙ ТЕХНИКИ
// ============================================================
export const useUnitsGrid = (sort = 'default') =>
    useQuery({
        queryKey: ['units-grid', sort],
        queryFn: () => api.getUnitsGrid(sort).then((r) => r.data),
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
    });

// ============================================================
// ГЛОБАЛЬНЫЙ ЛОГ ИЗМЕНЕНИЙ
// ============================================================
export const useGlobalHistory = (limit = 50) =>
    useQuery({
        queryKey: ['units-history-global', limit],
        queryFn: () => api.getGlobalHistory({ limit }).then((r) => r.data),
        staleTime: 20 * 1000,
    });


// ============================================================
// ИСТОРИЯ КОНКРЕТНОЙ ТЕХНИКИ — бесконечная пагинация
// ============================================================
export const useUnitHistory = (unitId, limit = 50) =>
    useInfiniteQuery({
        queryKey: ['unit-history', unitId],
        queryFn: ({ pageParam }) =>
            api
                .getUnitHistory(unitId, {
                    limit,
                    before_changed_at: pageParam?.changed_at,
                    before_id: pageParam?.id,
                })
                .then((r) => r.data),
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
        enabled: !!unitId,
        staleTime: 20 * 1000,
    });