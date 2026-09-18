import apiClient from './client';

export const getCalls = (params = {}) => apiClient.get('/calls', { params });
export const getMunicipalities = () => apiClient.get('/calls/municipalities');
export const getCall = (id) => apiClient.get(`/calls/${id}`);
export const createCall = () => apiClient.post('/calls');
export const updateCall = (id, data) => apiClient.put(`/calls/${id}`, data);
export const setCallStatus = (id, status) =>
    apiClient.put(`/calls/${id}/status`, { status });
export const setCallUnits = (id, unitIds) =>
    apiClient.put(`/calls/${id}/units`, { unit_ids: unitIds });
export const addCallEvent = (id, data) =>
    apiClient.post(`/calls/${id}/events`, data);
export const deleteCallEvent = (id, eventId) =>
    apiClient.delete(`/calls/${id}/events/${eventId}`);
export const getCallDepartments = (id) => apiClient.get(`/calls/${id}/departments`);
export const setCallDepartments = (id, departmentIds) =>
    apiClient.put(`/calls/${id}/departments`, { department_ids: departmentIds });