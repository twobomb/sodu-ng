import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/dictionaries';

const listHook = (key, fn) =>
    useQuery({
        queryKey: [key],
        queryFn: () => fn().then((r) => r.data),
        staleTime: 60 * 1000,
    });

// Любое изменение справочников обновляет справочники и карточки вызовов
const invalidateAll = (qc) => {
    qc.invalidateQueries(['fire-categories']);
    qc.invalidateQueries(['fire-causes']);
    qc.invalidateQueries(['fire-nonaccount']);
    qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'calls' || q.queryKey[0] === 'call',
    });
};

const mutateFactory = (qc, fn) =>
    useMutation({ mutationFn: fn, onSuccess: () => invalidateAll(qc) });

// ============================================================
// Категории пожаров
// ============================================================
export const useFireCategories = () =>
    listHook('fire-categories', api.getFireCategories);
export const useCreateFireCategory = () =>
    mutateFactory(useQueryClient(), api.createFireCategory);
export const useUpdateFireCategory = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateFireCategory(id, data),
        onSuccess: () => invalidateAll(qc),
    });
};
export const useDeleteFireCategory = () =>
    mutateFactory(useQueryClient(), api.deleteFireCategory);

// ============================================================
// Причины пожара
// ============================================================
export const useFireCauses = () => listHook('fire-causes', api.getFireCauses);
export const useCreateFireCause = () =>
    mutateFactory(useQueryClient(), api.createFireCause);
export const useUpdateFireCause = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateFireCause(id, data),
        onSuccess: () => invalidateAll(qc),
    });
};
export const useDeleteFireCause = () =>
    mutateFactory(useQueryClient(), api.deleteFireCause);

// ============================================================
// Причины неучёта пожара
// ============================================================
export const useFireNonaccountReasons = () =>
    listHook('fire-nonaccount', api.getFireNonaccountReasons);
export const useCreateFireNonaccountReason = () =>
    mutateFactory(useQueryClient(), api.createFireNonaccountReason);
export const useUpdateFireNonaccountReason = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateFireNonaccountReason(id, data),
        onSuccess: () => invalidateAll(qc),
    });
};
export const useDeleteFireNonaccountReason = () =>
    mutateFactory(useQueryClient(), api.deleteFireNonaccountReason);