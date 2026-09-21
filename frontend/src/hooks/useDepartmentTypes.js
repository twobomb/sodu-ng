import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/departmentTypes';

const invalidateRelated = (qc) => {
    qc.invalidateQueries(['department-types']);
    qc.invalidateQueries(['departments']);
};

export const useAllDepartmentTypes = () =>
    useQuery({
        queryKey: ['department-types'],
        queryFn: () => api.getDepartmentTypes().then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useCreateDepartmentType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createDepartmentType,
        onSuccess: () => invalidateRelated(qc),
    });
};

export const useUpdateDepartmentType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateDepartmentType(id, data),
        onSuccess: () => invalidateRelated(qc),
    });
};

export const useDeleteDepartmentType = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.deleteDepartmentType,
        onSuccess: () => invalidateRelated(qc),
    });
};