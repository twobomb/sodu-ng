import { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { useAttachmentBlob, downloadAttachment, formatFileSize } from '../../lib/attachmentUrl';

const ImageViewer = ({ attachment, onClose }) => {
    const url = useAttachmentBlob(attachment.id, 'download');
    const [loading, setLoading] = useState(false);

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

    const handleDownload = async () => {
        setLoading(true);
        try {
            await downloadAttachment(attachment.id, attachment.original_name);
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
                    <button
                        onClick={handleDownload}
                        className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center"
                        title="Скачать"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Download className="h-5 w-5" />
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Картинка */}
            <div
                className="flex-1 flex items-center justify-center p-4 min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                {url ? (
                    <img
                        src={url}
                        alt={attachment.original_name}
                        className="max-h-full max-w-full object-contain"
                    />
                ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                )}
            </div>
        </div>
    );
};

export default ImageViewer;