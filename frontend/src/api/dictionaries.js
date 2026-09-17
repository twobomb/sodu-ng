import apiClient from './client';

// ----- Категории пожаров (дерево) -----
export const getFireCategories = () => apiClient.get('/fire-categories');
export const createFireCategory = (data) => apiClient.post('/fire-categories', data);
export const updateFireCategory = (id, data) =>
    apiClient.put(`/fire-categories/${id}`, data);
export const deleteFireCategory = (id) =>
    apiClient.delete(`/fire-categories/${id}`);

// ----- Причины пожара -----
export const getFireCauses = () => apiClient.get('/fire-causes');
export const createFireCause = (data) => apiClient.post('/fire-causes', data);
export const updateFireCause = (id, data) =>
    apiClient.put(`/fire-causes/${id}`, data);
export const deleteFireCause = (id) => apiClient.delete(`/fire-causes/${id}`);

// ----- Причины неучёта пожара -----
export const getFireNonaccountReasons = () =>
    apiClient.get('/fire-nonaccount-reasons');
export const createFireNonaccountReason = (data) =>
    apiClient.post('/fire-nonaccount-reasons', data);
export const updateFireNonaccountReason = (id, data) =>
    apiClient.put(`/fire-nonaccount-reasons/${id}`, data);
export const deleteFireNonaccountReason = (id) =>
    apiClient.delete(`/fire-nonaccount-reasons/${id}`);