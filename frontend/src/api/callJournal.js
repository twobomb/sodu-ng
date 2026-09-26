import apiClient from './client';

// Выгрузка журнала вызовов в Excel по шаблону
export const exportCallJournal = (data) =>
    apiClient.post('/call-journal/export', data);