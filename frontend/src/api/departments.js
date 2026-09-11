import apiClient from './client';

export const getDepartments = () => apiClient.get('/departments');
export const getDepartment = (id) => apiClient.get(`/departments/${id}`);
export const createDepartment = (data) => apiClient.post('/departments', data);
export const reorderDepartments = (updates) =>
    apiClient.put('/departments/reorder', { updates });
export const updateDepartment = (id, data) => apiClient.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => apiClient.delete(`/departments/${id}`);
