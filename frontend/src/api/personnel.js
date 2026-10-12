import apiClient from './client';

// ----- Личный состав («л/с») -----
export const getPersonnel = () => apiClient.get('/personnel');
export const getPerson = (id) => apiClient.get(`/personnel/${id}`);
export const createPerson = (data) => apiClient.post('/personnel', data);
export const updatePerson = (id, data) => apiClient.put(`/personnel/${id}`, data);
export const deletePerson = (id) => apiClient.delete(`/personnel/${id}`);
export const reorderPersonnel = (personnelIds) =>
    apiClient.put('/personnel/order', { personnel_ids: personnelIds });

// Привязка людей к технике (эндпоинт техники, но по смыслу — личный состав)
export const setUnitPersonnel = (unitId, personnelIds) =>
    apiClient.put(`/units/${unitId}/personnel`, { personnel_ids: personnelIds });
