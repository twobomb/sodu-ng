import apiClient from './client';

// Каталог доступных полей и операторов для конструктора выборки
export const getSampleFields = () => apiClient.get('/call-samples/fields');

// Список сохранённых выборок
export const getCallSamples = () => apiClient.get('/call-samples');

// Сохранить / пересохранить выборку по имени
export const saveCallSample = (data) => apiClient.post('/call-samples', data);

// Обновить существующую выборку (по id)
export const updateCallSample = (id, data) => apiClient.put(`/call-samples/${id}`, data);

export const deleteCallSample = (id) => apiClient.delete(`/call-samples/${id}`);

// Сколько вызовов попадает под выборку (предпросмотр)
export const previewCallSample = (data) => apiClient.post('/call-samples/preview', data);
