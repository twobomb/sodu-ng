import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/municipalities';

export const useAllMunicipalities = () =>
    useQuery({
        queryKey: ['municipalities'],
        queryFn: () => api.getMunicipalities().then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useCreateMunicipality = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createMunicipality,
        onSuccess: () => {
            qc.invalidateQueries(['municipalities']);
            qc.invalidateQueries(['departments']);
        },
    });
};

export const useDeleteMunicipality = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deleteMunicipality,
        onSuccess: () => {
            qc.invalidateQueries(['municipalities']);
            qc.invalidateQueries(['departments']);
        },
    });
};
