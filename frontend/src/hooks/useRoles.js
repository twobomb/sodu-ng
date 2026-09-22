import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getRoles, createRole, updateRole, deleteRole, getPermissionsCatalog,
} from '../api/roles';

export const useRoles = () =>
    useQuery({ queryKey: ['roles'], queryFn: getRoles, refetchOnWindowFocus: false });

export const usePermissionsCatalog = () =>
    useQuery({ queryKey: ['permissionsCatalog'], queryFn: getPermissionsCatalog, staleTime: 5 * 60 * 1000 });

export const useCreateRole = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: createRole, onSuccess: () => qc.invalidateQueries(['roles']) });
};

export const useUpdateRole = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ code, data }) => updateRole(code, data),
        onSuccess: () => qc.invalidateQueries(['roles']),
    });
};

export const useDeleteRole = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: deleteRole, onSuccess: () => qc.invalidateQueries(['roles']) });
};