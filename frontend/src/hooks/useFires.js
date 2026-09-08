import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFires, createFire, updateFire, deleteFire } from '../api/fires';

export const useFires = () => {
    return useQuery({
        queryKey: ['fires'],
        queryFn: getFires,
        refetchOnWindowFocus: true,
    });
};

export const useCreateFire = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createFire,
        onSuccess: () => {
            queryClient.invalidateQueries(['fires']);
        },
    });
};

export const useUpdateFire = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateFire(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['fires']);
        },
    });
};

export const useDeleteFire = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteFire,
        onSuccess: () => {
            queryClient.invalidateQueries(['fires']);
        },
    });
};