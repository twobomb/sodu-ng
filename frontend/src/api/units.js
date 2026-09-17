import apiClient from './client';

// ----- Техника -----
export const getUnits = () => apiClient.get('/units');
export const getUnit = (id) => apiClient.get(`/units/${id}`);
export const createUnit = (data) => apiClient.post('/units', data);
export const updateUnit = (id, data) => apiClient.put(`/units/${id}`, data);
export const deleteUnit = (id) => apiClient.delete(`/units/${id}`);
export const changeUnitStatus = (id, data) =>
    apiClient.post(`/units/${id}/status`, data);
export const getUnitsGrid = (sort = 'default') =>
    apiClient.get('/units/grid', { params: { sort } });
export const getAvailableCalls = () => apiClient.get('/units/calls-available');
export const updateUnitMetrics = (id, data) =>
    apiClient.post(`/units/${id}/metrics`, data);
export const getGlobalHistory = (params = {}) =>
    apiClient.get('/units/history/global', { params });
export const getUnitHistory = (id, params = {}) =>
    apiClient.get(`/units/${id}/history`, { params });
// ----- Типы техники -----
export const getUnitTypes = () => apiClient.get('/unit-types');
export const createUnitType = (data) => apiClient.post('/unit-types', data);
export const updateUnitType = (id, data) =>
    apiClient.put(`/unit-types/${id}`, data);
export const deleteUnitType = (id) => apiClient.delete(`/unit-types/${id}`);

// ----- Статусы техники -----
export const getUnitStatuses = () => apiClient.get('/unit-statuses');
export const createUnitStatus = (data) =>
    apiClient.post('/unit-statuses', data);
export const updateUnitStatus = (id, data) =>
    apiClient.put(`/unit-statuses/${id}`, data);
export const deleteUnitStatus = (id) =>
    apiClient.delete(`/unit-statuses/${id}`);