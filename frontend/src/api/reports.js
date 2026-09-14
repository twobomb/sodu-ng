import apiClient from './client';

export const reportBug = (data) => apiClient.post('/reports/bug', data);