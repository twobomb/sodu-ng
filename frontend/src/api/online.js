import apiClient from './client';

export const getOnlineUsers = () => apiClient.get('/online');