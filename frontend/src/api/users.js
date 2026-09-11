import apiClient from './client';

export const getUsers = () => apiClient.get('/users');
export const getUser = (id) => apiClient.get(`/users/${id}`);
export const createUser = (data) => apiClient.post('/users', data);
export const updateUser = (id, data) => apiClient.put(`/users/${id}`, data);
export const deleteUser = (id) => apiClient.delete(`/users/${id}`);
export const blockUser = (id) => apiClient.post(`/users/${id}/block`);
export const unblockUser = (id) => apiClient.post(`/users/${id}/unblock`);