import apiClient from './client';

export const getSettings = () => apiClient.get('/settings');
export const updateSettings = (data) => apiClient.put('/settings', data);
export const getPublicSettings = () => apiClient.get('/settings/public');