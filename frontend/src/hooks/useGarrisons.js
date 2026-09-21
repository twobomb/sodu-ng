import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/garrisons';

const invalidateRelated = (qc) => {
    qc.invalidateQueries(['garrisons']);
    qc.invalidateQueries(['departments']);
};

export const useAllGarrisons = () =>
    useQuery({
        queryKey: ['garrisons'],
        queryFn: () => api.getGarrisons().then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useCreateGarrison = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createGarrison,
        onSuccess: () => invalidateRelated(qc),
    });
};

export const useUpdateGarrison = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateGarrison(id, data),
        onSuccess: () => invalidateRelated(qc),
    });
};

export const useDeleteGarrison = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deleteGarrison,
        onSuccess: () => invalidateRelated(qc),
    });
};

export const useReorderGarrisons = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.reorderGarrisons,
        onSuccess: () => invalidateRelated(qc),
    });
};