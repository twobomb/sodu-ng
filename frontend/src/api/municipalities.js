import apiClient from './client';

export const getMunicipalities = () => apiClient.get('/municipalities');
export const createMunicipality = (data) => apiClient.post('/municipalities', data);
export const deleteMunicipality = (id) =>
    apiClient.delete(`/municipalities/${id}`);
