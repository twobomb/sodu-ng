import apiClient from './client';

export const getSettings = () => apiClient.get('/settings');
export const updateSettings = (data) => apiClient.put('/settings', data);
export const getPublicSettings = () => apiClient.get('/settings/public');
export const getDiskInfo = () => apiClient.get('/settings/disk');
export const getSoduSettings = () => apiClient.get('/settings/sodu');
export const updateSoduSettings = (data) =>
    apiClient.put('/settings/sodu', data);

// Безопасность паролей: чтение — всем, изменение — только разработчику
export const getSecuritySettings = () => apiClient.get('/settings/security');
export const updateSecuritySettings = (data) =>
    apiClient.put('/settings/security', data);

export const sendBroadcast = (data) =>
    apiClient.post('/settings/broadcast', data);

export const getAdminFiles = () => apiClient.get('/settings/files');
export const getFolderSize = () => apiClient.get('/settings/files/folder-size');
export const deleteAdminFiles = (files) =>
    apiClient.post('/settings/files/delete', { files });