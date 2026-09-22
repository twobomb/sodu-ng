import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
} from '../api/users';

export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
        refetchOnWindowFocus: false,
    });
};

export const useCreateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createUser,
        onSuccess: () => queryClient.invalidateQueries(['users']),
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateUser(id, data),
        onSuccess: () => queryClient.invalidateQueries(['users']),
    });
};

export const useDeleteUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteUser,
        onSuccess: () => queryClient.invalidateQueries(['users']),
    });
};

export const useBlockUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: blockUser,
        onSuccess: () => queryClient.invalidateQueries(['users']),
    });
};

export const useUnblockUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: unblockUser,
        onSuccess: () => queryClient.invalidateQueries(['users']),
    });
};