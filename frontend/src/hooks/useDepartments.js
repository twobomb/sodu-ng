import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
} from '../api/departments';

export const useDepartments = () => {
    return useQuery({
        queryKey: ['departments'],
        queryFn: getDepartments,
        refetchOnWindowFocus: true,
    });
};

export const useCreateDepartment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries(['departments']);
        },
    });
};

export const useUpdateDepartment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateDepartment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['departments']);
        },
    });
};

export const useDeleteDepartment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries(['departments']);
        },
    });
};

export const useReorderDepartments = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: reorderDepartments,
        onSuccess: () => {
            queryClient.invalidateQueries(['departments']);
        },
    });
};