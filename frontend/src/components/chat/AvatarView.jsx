import { useAttachmentBlob } from '../../lib/attachmentUrl';

/**
 * Универсальный компонент отображения аватара.
 * Принимает:
 *   - внешний URL (http/https) — рендерит как есть
 *   - attachment id (uuid)
 *   - строку вида "/api/chat/attachments/<uuid>/preview"
 *   - null — рендерит fallback
 */
const extractAttachmentId = (value) => {
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return null;
    // Парсим из URL
    const m = value.match(/attachments\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    // Если это просто UUID
    if (/^[0-9a-f-]{36}$/i.test(value)) return value;
    return null;
};

const AvatarView = ({ avatar, name, size = 40, className = '', textClassName = '' }) => {
    const isExternal = avatar?.startsWith('http://') || avatar?.startsWith('https://');
    const attachmentId = extractAttachmentId(avatar);
    const blobUrl = useAttachmentBlob(isExternal ? null : attachmentId, 'preview');

    const src = isExternal ? avatar : blobUrl;
    const initial = (name || '?').charAt(0).toUpperCase();
    const sizeStyle = { width: size, height: size };

    if (src) {
        return (
            <img
                src={src}
                alt=""
                style={sizeStyle}
                className={`rounded-full object-cover flex-shrink-0 ${className}`}
            />
        );
    }

    return (
        <div
            style={sizeStyle}
            className={`rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-400 to-red-500 text-white font-medium ${className}`}
        >
            <span className={textClassName || 'text-sm'}>{initial}</span>
        </div>
    );
};

export default AvatarView;