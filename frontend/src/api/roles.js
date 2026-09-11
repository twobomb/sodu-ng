import apiClient from './client';

export const getRoles = () => apiClient.get('/roles');
export const getRole = (code) => apiClient.get(`/roles/${code}`);
export const createRole = (data) => apiClient.post('/roles', data);
export const updateRole = (code, data) => apiClient.put(`/roles/${code}`, data);
export const deleteRole = (code) => apiClient.delete(`/roles/${code}`);
export const getPermissionsCatalog = () => apiClient.get('/roles/permissions/catalog');