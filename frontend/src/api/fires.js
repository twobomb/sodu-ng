import apiClient from './client';

export const getFires = () => apiClient.get('/fires');
export const getFire = (id) => apiClient.get(`/fires/${id}`);
export const createFire = (data) => apiClient.post('/fires', data);
export const updateFire = (id, data) => apiClient.put(`/fires/${id}`, data);
export const deleteFire = (id) => apiClient.delete(`/fires/${id}`);