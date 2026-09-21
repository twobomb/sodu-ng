import apiClient from './client';

export const getMunicipalities = () => apiClient.get('/municipalities');
export const createMunicipality = (data) => apiClient.post('/municipalities', data);
export const updateMunicipality = (id, data) =>
    apiClient.put(`/municipalities/${id}`, data);
export const deleteMunicipality = (id) =>
    apiClient.delete(`/municipalities/${id}`);
export const reorderMunicipalities = (municipalityIds) =>
    apiClient.put('/municipalities/order', { municipality_ids: municipalityIds });
