import { useEffect, useState } from 'react';
import apiClient from '@/api/client';

export const useAttachmentBlob = (attachmentId, kind = 'download') => {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!attachmentId) return;
        let objectUrl = null;
        let cancelled = false;

        apiClient
            .get(`/chat/attachments/${attachmentId}/${kind}`, {
                responseType: 'blob',
            })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setUrl(objectUrl);
            })
            .catch(() => setUrl(null));

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [attachmentId, kind]);

    return url;
};

export const downloadAttachment = async (attachmentId, filename) => {
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
};

export const parseAttachmentId = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return null;
    const m = value.match(/attachments\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    if (/^[0-9a-f-]{36}$/i.test(value)) return value;
    return null;
};

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

export const formatFileSize = (bytes) => {
    if (!bytes || bytes < 0) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
};