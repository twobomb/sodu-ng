import apiClient from './client';

export const getDepartmentTypes = () => apiClient.get('/department-types');
export const createDepartmentType = (data) =>
    apiClient.post('/department-types', data);
export const updateDepartmentType = (id, data) =>
    apiClient.put(`/department-types/${id}`, data);
export const deleteDepartmentType = (id) =>
    apiClient.delete(`/department-types/${id}`);