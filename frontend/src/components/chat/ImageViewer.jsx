import { useEffect, useState } from 'react';
import { X, Download, Loader2, FileWarning } from 'lucide-react';
import {
    useAttachmentBlob,
    downloadAttachment,
    formatFileSize,
} from '../../lib/attachmentUrl';

const ImageViewer = ({ attachment, onClose }) => {
    const url = useAttachmentBlob(attachment.id, 'download');
    const [loading, setLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [waitingTooLong, setWaitingTooLong] = useState(false);

    // Esc — закрыть, блокируем скролл body
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    // Если blob так и не пришёл за 5 секунд — считаем, что файл недоступен
    useEffect(() => {
        if (url) {
            setWaitingTooLong(false);
            return;
        }
        const timer = setTimeout(() => setWaitingTooLong(true), 5000);
        return () => clearTimeout(timer);
    }, [url]);

    const showError = imageError || waitingTooLong;

    const handleDownload = async () => {
        setLoading(true);
        try {
            await downloadAttachment(attachment.id, attachment.original_name);
        } catch (err) {
            alert(err.message || 'Не удалось скачать файл');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
            onClick={onClose}
        >
            {/* Шапка */}
            <div
                className="flex items-center justify-between p-4 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                        {attachment.original_name}
                    </div>
                    <div className="text-xs text-white/60">
                        {formatFileSize(attachment.size)}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!showError && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={loading}
                            className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center disabled:opacity-50"
                            title="Скачать"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Download className="h-5 w-5" />
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center"
                        title="Закрыть"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Контент */}
            <div
                className="flex-1 flex items-center justify-center p-4 min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                {showError ? (
                    <div className="flex flex-col items-center gap-3 text-center text-white/70 max-w-sm">
                        <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                            <FileWarning className="h-8 w-8 text-orange-400" />
                        </div>
                        <p className="text-base font-medium text-white">
                            Файл был удалён с сервера
                        </p>
                        <p className="text-xs text-white/60">
                            Изображение больше недоступно. Возможно, оно было удалено
                            вручную или утеряно при обслуживании.
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                        >
                            Закрыть
                        </button>
                    </div>
                ) : url ? (
                    <img
                        src={url}
                        alt={attachment.original_name}
                        className="max-h-full max-w-full object-contain"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-white/60">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-xs">Загрузка изображения...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageViewer;