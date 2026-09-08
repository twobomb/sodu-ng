import apiClient from './client';

export const getDepartments = () => apiClient.get('/departments');