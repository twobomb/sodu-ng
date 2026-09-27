import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/callSamples';

// ============================================================
// Конструктор выборки вызовов: поля, сохранённые выборки, мутации
// ============================================================

// Каталог полей и операторов (не меняется — держим долго в кэше)
export const useSampleFields = () =>
    useQuery({
        queryKey: ['call-sample-fields'],
        queryFn: () => api.getSampleFields().then((r) => r.data),
        staleTime: 30 * 60 * 1000,
    });

// Список сохранённых выборок
export const useCallSamples = () =>
    useQuery({
        queryKey: ['call-samples'],
        queryFn: () => api.getCallSamples().then((r) => r.data),
        refetchOnWindowFocus: false,
    });

export const useSaveCallSample = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.saveCallSample(data),
        onSuccess: () => qc.invalidateQueries(['call-samples']),
    });
};

export const useUpdateCallSample = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateCallSample(id, data),
        onSuccess: () => qc.invalidateQueries(['call-samples']),
    });
};

export const useDeleteCallSample = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.deleteCallSample(id),
        onSuccess: () => qc.invalidateQueries(['call-samples']),
    });
};

export const usePreviewCallSample = () =>
    useMutation({
        mutationFn: (data) => api.previewCallSample(data).then((r) => r.data),
    });
