import apiClient from './client';

export const getGarrisons = () => apiClient.get('/garrisons');
export const createGarrison = (data) => apiClient.post('/garrisons', data);
export const updateGarrison = (id, data) =>
    apiClient.put(`/garrisons/${id}`, data);
export const deleteGarrison = (id) => apiClient.delete(`/garrisons/${id}`);
export const reorderGarrisons = (garrisonIds) =>
    apiClient.put('/garrisons/order', { garrison_ids: garrisonIds });