import apiClient from './client';

export const login = (username, password) =>
  apiClient.post('/auth/login', { username, password });

export const logout = () => apiClient.post('/auth/logout');

export const getCurrentUser = () => apiClient.get('/auth/me');