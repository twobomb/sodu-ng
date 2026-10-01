import apiClient from './client';

// Выгрузка суточной ведомости в Excel по шаблону
export const exportDailyStatement = (data) =>
    apiClient.post('/daily-statement/export', data);
