import apiClient from './client';

export const getUnits = () => apiClient.get('/units');
export const getUnit = (id) => apiClient.get(`/units/${id}`);
export const createUnit = (data) => apiClient.post('/units', data);
export const updateUnit = (id, data) => apiClient.put(`/units/${id}`, data);
export const deleteUnit = (id) => apiClient.delete(`/units/${id}`);