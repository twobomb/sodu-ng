import apiClient from './client';

// Автодополнение адреса из справочника ФИАС (SQLite на бэкенде)
export const getAddressAutocomplete = (q, limit = 8) =>
    apiClient.get('/address/autocomplete', {params: {q, limit}});