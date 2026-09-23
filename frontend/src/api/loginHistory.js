import apiClient from './client';

export const getLoginHistory = (params) =>
    apiClient.get('/login-history', { params });