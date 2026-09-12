import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';

// ============================================================
// Храним blob-URL в кеше React Query.
// Ключ — attachmentId + тип (preview/download).
// Один и тот же файл грузится ОДИН раз за сессию.
// ============================================================

/**
 * Грузит бинарник и возвращает blob-url.
 * Кешируется через React Query: повторные вызовы с тем же
 * attachmentId не делают запрос.
 */
export const useAttachmentBlob = (attachmentId, kind = 'download') => {
    const { data } = useQuery({
        queryKey: ['attachment-blob', attachmentId, kind],
        queryFn: async () => {
            const res = await apiClient.get(
                `/chat/attachments/${attachmentId}/${kind}`,
                { responseType: 'blob' }
            );
            return URL.createObjectURL(res.data);
        },
        enabled: !!attachmentId,
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,               // 410 — постоянная ошибка, ретраить бессмысленно
        retryOnMount: false,        // не пытаться снова при монтировании
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    return data || null;
};

// ============================================================
// Скачивание (не кешируется — разовое действие)
// ============================================================
export const downloadAttachment = async (attachmentId, filename) => {
    try {
        const res = await apiClient.get(
            `/chat/attachments/${attachmentId}/download`,
            { responseType: 'blob' }
        );
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { ok: true };
    } catch (err) {
        // Пытаемся прочитать сообщение об ошибке из blob-ответа
        let message = 'Не удалось скачать файл';
        const status = err.response?.status;
        const data = err.response?.data;

        if (data instanceof Blob) {
            try {
                const text = await data.text();
                const json = JSON.parse(text);
                if (json?.error) message = json.error;
            } catch (_) {
                // ignore
            }
        } else if (data?.error) {
            message = data.error;
        }

        if (status === 410) {
            // Файл удалён с сервера
            throw new Error(message || 'Файл был удалён с сервера');
        }
        if (status === 403) {
            throw new Error('Нет доступа к файлу');
        }
        throw new Error(message);
    }
};
// ============================================================
// Парсинг attachment-id из разных форм
// ============================================================
export const parseAttachmentId = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return null;
    const m = value.match(/attachments\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    if (/^[0-9a-f-]{36}$/i.test(value)) return value;
    return null;
};

// ============================================================
// Иконка по mime/расширению
// ============================================================
export const getFileIcon = (mimeType = '', originalName = '') => {
    const ext = (originalName.split('.').pop() || '').toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf') || ext === 'pdf') return 'pdf';
    if (
        mimeType.includes('excel') ||
        mimeType.includes('spreadsheet') ||
        ['xls', 'xlsx', 'csv'].includes(ext)
    )
        return 'excel';
    if (
        mimeType.includes('word') ||
        mimeType.includes('document') ||
        ['doc', 'docx', 'rtf'].includes(ext)
    )
        return 'word';
    if (
        mimeType.includes('zip') ||
        mimeType.includes('archive') ||
        ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
    )
        return 'zip';
    if (mimeType.startsWith('text/') || ['txt', 'md', 'log'].includes(ext))
        return 'txt';
    return 'file';
};

// ============================================================
// Форматирование размера
// ============================================================
export const formatFileSize = (bytes) => {
    if (!bytes || bytes < 0) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
};