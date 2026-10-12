import apiClient from './client';

export const getCalls = (params = {}) => apiClient.get('/calls', { params });
export const getMonitorCalls = () => apiClient.get('/calls/monitor');
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
export const getCallHistory = (id) => apiClient.get(`/calls/${id}/history`);
export const setCallDepartments = (id, departmentIds) =>
    apiClient.put(`/calls/${id}/departments`, { department_ids: departmentIds });
export const getEventTemplates = () => apiClient.get('/calls/event-templates');
export const createEventTemplate = (data) =>
    apiClient.post('/calls/event-templates', data);
export const deleteEventTemplate = (templateId) =>
    apiClient.delete(`/calls/event-templates/${templateId}`);
// Справочник значений поля «Объект»
export const getObjectTemplates = () => apiClient.get('/calls/object-templates');
export const createObjectTemplate = (data) =>
    apiClient.post('/calls/object-templates', data);
export const deleteObjectTemplate = (templateId) =>
    apiClient.delete(`/calls/object-templates/${templateId}`);
// Справочники параметров и значений блока «Объекты»
export const getObjectParams = () => apiClient.get('/calls/object-params');
export const createObjectParam = (data) => apiClient.post('/calls/object-params', data);
export const deleteObjectParam = (paramId) => apiClient.delete(`/calls/object-params/${paramId}`);
export const createObjectParamValue = (data) => apiClient.post('/calls/object-param-values', data);
export const deleteObjectParamValue = (valueId) => apiClient.delete(`/calls/object-param-values/${valueId}`);