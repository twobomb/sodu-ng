import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSecuritySettings, updateSecuritySettings } from '../api/settings';
import { changePassword } from '../api/auth';

// ============================================================
// БЕЗОПАСНОСТЬ ПАРОЛЕЙ
// ============================================================

// Действующие настройки (политика сложности, срок действия, требования)
export const useSecuritySettings = () =>
    useQuery({
        queryKey: ['securitySettings'],
        queryFn: () => getSecuritySettings().then((r) => r.data),
        staleTime: 60 * 1000,
    });

export const useUpdateSecuritySettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateSecuritySettings,
        onSuccess: () => {
            qc.invalidateQueries(['securitySettings']);
            qc.invalidateQueries(['settings']);
        },
    });
};

// Смена собственного пароля
export const useChangePassword = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ currentPassword, newPassword }) =>
            changePassword(currentPassword, newPassword),
        onSuccess: () => {
            // После смены пароля перечитываем профиль — обновятся сведения
            // о сроке действия пароля.
            qc.invalidateQueries(['me']);
        },
    });
};
