import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/personnel';

// ============================================================
// ЛИЧНЫЙ СОСТАВ («л/с»)
// ============================================================
export const usePersonnel = (options = {}) =>
    useQuery({
        queryKey: ['personnel'],
        queryFn: () => api.getPersonnel().then((r) => r.data),
        enabled: options.enabled !== false,
        refetchOnWindowFocus: false,
    });

export const useCreatePerson = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createPerson,
        onSuccess: () => qc.invalidateQueries(['personnel']),
    });
};

export const useUpdatePerson = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updatePerson(id, data),
        onSuccess: () => qc.invalidateQueries(['personnel']),
    });
};

export const useDeletePerson = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deletePerson,
        onSuccess: () => qc.invalidateQueries(['personnel']),
    });
};

export const useReorderPersonnel = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (personnelIds) => api.reorderPersonnel(personnelIds),
        onSuccess: () => qc.invalidateQueries(['personnel']),
    });
};

// Привязка выбранных людей к технике (используется на странице «Техника»)
export const useSetUnitPersonnel = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ unitId, personnelIds }) => api.setUnitPersonnel(unitId, personnelIds),
        onSuccess: () => {
            qc.invalidateQueries(['personnel']);
            qc.invalidateQueries(['units']);
            qc.invalidateQueries(['units-grid']);
        },
    });
};
