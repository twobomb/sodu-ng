import apiClient from './client';

// Список записей подразделения (даты + статусы, для календаря)
export const getLineNotesByDepartment = (departmentId) =>
    apiClient.get(`/line-notes/department/${departmentId}`);

// Полная записка за дату (null если нет)
export const getLineNote = (departmentId, date) =>
    apiClient.get(`/line-notes/department/${departmentId}/${date}`);

// Статусы записей всех доступных подразделений за дату
export const getLineNotesStatus = (date) =>
    apiClient.get(`/line-notes/status/${date}`);

export const createLineNote = (data) => apiClient.post('/line-notes', data);

export const updateLineNote = (id, data) => apiClient.put(`/line-notes/${id}`, data);

// Копирование записки с одной даты на другую (цель — только черновик/пустая дата)
export const copyLineNote = (data) => apiClient.post('/line-notes/copy', data);

// Выгрузка всех строевых в Excel по шаблону
export const exportLineNotes = (data) => apiClient.post('/line-notes/export', data);

// Выгрузка строевой ТПСГ (компактный шаблон .xlsx)
export const exportLineNotesTpsg = (data) => apiClient.post('/line-notes/export/tpsg', data);