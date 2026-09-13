import { useState } from 'react';
import {
    FileText,
    FileSpreadsheet,
    FileArchive,
    FileType,
    File as FileIcon,
    Image as ImageIcon,
    Download,
    Loader2,
    Reply,
    Edit3,
    Trash2,
    Check,
    CheckCheck,
    MoreVertical,
} from 'lucide-react';
import MessageReadersDialog from './MessageReadersDialog';
import DisplayName from './DisplayName';
import { analyzeEmojiContent, getEmojiSizeClass } from '../../lib/emojiHelper';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useDeleteMessage } from '../../hooks/useChat';
import {
    useAttachmentBlob,
    downloadAttachment,
    getFileIcon,
    formatFileSize,
} from '../../lib/attachmentUrl';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import ImageViewer from './ImageViewer';
import AvatarView from './AvatarView';

const EDIT_WINDOW_MIN = 10;

const ICONS = {
    image: ImageIcon,
    pdf: FileType,
    excel: FileSpreadsheet,
    word: FileText,
    zip: FileArchive,
    txt: FileText,
    file: FileIcon,
};

const ICON_COLORS = {
    image: 'text-pink-600 bg-pink-50',
    pdf: 'text-red-600 bg-red-50',
    excel: 'text-green-600 bg-green-50',
    word: 'text-blue-600 bg-blue-50',
    zip: 'text-amber-600 bg-amber-50',
    txt: 'text-slate-600 bg-slate-100',
    file: 'text-slate-600 bg-slate-100',
};

const canEdit = (message) => {
    if (!message.created_at) return false;
    if (message.deleted_at) return false;
    if (message.content_type !== 'text') return false;
    const ageMs = Date.now() - new Date(message.created_at).getTime();
    return ageMs < EDIT_WINDOW_MIN * 60 * 1000;
};

const MessageBubble = ({ message, conversation, members, onReply, onEdit }) => {
    const { user } = useAuth();
    const { has } = usePermissions();
    const [readersOpen, setReadersOpen] = useState(false);
    const deleteMessage = useDeleteMessage(message.conversation_id);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [openImage, setOpenImage] = useState(null);

    const isOwn = message.user_id === user?.id;

    // -------- Системное сообщение --------
    if (message.content_type === 'system') {
        return (
            <div className="flex justify-center my-2">
                <div className="text-[11px] text-slate-500 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100 max-w-[80%] text-center">
                    {message.content}
                </div>
            </div>
        );
    }

    const isDeleted = !!message.deleted_at;
    const canModerate = has('chat.moderate');
    const canEditThis = isOwn && canEdit(message);
    const canDeleteThis = !isDeleted && (isOwn || canModerate);

    const displayName =
        message.display_name || message.username || 'Удалённый пользователь';
    const time = format(new Date(message.created_at), 'HH:mm', { locale: ru });

    const isGroupOrChannel =
        conversation?.type === 'channel' || conversation?.type === 'group';

    // ============================================================
    // Галочки: сколько участников (кроме автора) прочитали
    // ============================================================
    const readInfo = (() => {
        if (!isOwn || isDeleted) return null;
        if (!members || members.length < 2) return null;
        const others = members.filter((m) => m.user_id !== user?.id);
        const readCount = others.filter(
            (m) =>
                m.last_read_at &&
                new Date(m.last_read_at) >= new Date(message.created_at)
        ).length;
        return {
            readCount,
            total: others.length,
            allRead: readCount >= others.length,
        };
    })();

    const handleDelete = () => {
        deleteMessage.mutate(message.id, {
            onSuccess: () => setConfirmDelete(false),
        });
    };

    // -------- Удалённое --------
    if (isDeleted) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}>
                <div className="max-w-[75%] px-3 py-1.5 rounded-2xl bg-slate-100 border border-slate-200">
          <span className="text-xs italic text-slate-400">
            Сообщение удалено
          </span>
                </div>
            </div>
        );
    }

    const attachments = message.attachments || [];
    const images = attachments.filter((a) => a.mime_type?.startsWith('image/'));
    const files = attachments.filter((a) => !a.mime_type?.startsWith('image/'));

    // Аватар показываем только для чужих в группе/канале
    const showAvatar = !isOwn && isGroupOrChannel;

    // Кнопка "⋮"
    const actionButton = (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start mt-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-slate-200"
                    >
                        <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align={isOwn ? 'end' : 'start'}
                    side="bottom"
                    sideOffset={4}
                    collisionPadding={16}
                    avoidCollisions={true}
                    className="min-w-[180px] z-[150]"
                >
                    <DropdownMenuItem icon={Reply} onClick={() => onReply(message)}>
                        Ответить
                    </DropdownMenuItem>
                    {canEditThis && (
                        <DropdownMenuItem icon={Edit3} onClick={() => onEdit(message)}>
                            Редактировать
                        </DropdownMenuItem>
                    )}
                    {canDeleteThis && (
                        <DropdownMenuItem
                            icon={Trash2}
                            danger
                            onClick={() => setConfirmDelete(true)}
                        >
                            Удалить
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );

    // Определяем, является ли сообщение "только эмодзи"
    const emojiInfo =
        message.content_type === 'text' && message.content
            ? analyzeEmojiContent(message.content)
            : { isEmojiOnly: false, count: 0 };
    const emojiSizeClass = emojiInfo.isEmojiOnly
        ? getEmojiSizeClass(emojiInfo.count)
        : '';
    return (
        <>
            <div
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group`}
            >
                <div className="flex items-start gap-2 max-w-[85%]">
                    {/* Аватар — только чужие в группе/канале */}
                    {showAvatar && (
                        <AvatarView
                            avatar={message.avatar_url}
                            name={displayName}
                            size={32}
                            className="mt-0.5"
                        />
                    )}

                    {/* Кнопка ⋮ слева от пузыря — только для своих */}
                    {isOwn && actionButton}

                    {/* Пузырь */}
                    <div
                        className={`rounded-2xl px-3 py-2 text-sm break-words ${
                            isOwn
                                ? 'bg-orange-500 text-white rounded-br-sm'
                                : 'bg-white text-slate-800 rounded-bl-sm shadow-sm'
                        }`}
                    >
                        {/* Автор */}
                        {!isOwn && isGroupOrChannel && (
                            <div className="mb-0.5">
                                <DisplayName
                                    name={displayName}
                                    role={message.user_role}
                                    size="md"
                                />
                            </div>
                        )}

                        {/* Ответ на сообщение */}
                        {message.reply_message_id && (
                            <div
                                className={`mb-1.5 pl-2 border-l-2 rounded text-xs ${
                                    isOwn
                                        ? 'border-white/50 text-white/80'
                                        : 'border-orange-400 text-slate-500'
                                }`}
                            >
                                <div className="font-medium">
                                    <DisplayName
                                        name={
                                            message.reply_display_name ||
                                            message.reply_username ||
                                            'Удалено'
                                        }
                                        role={message.reply_user_role}
                                        isOwn={isOwn}
                                        size="sm"
                                    />
                                </div>
                                <div className="truncate max-w-[200px]">
                                    {message.reply_deleted_at
                                        ? 'Сообщение удалено'
                                        : message.reply_content_type === 'image'
                                            ? '📷 Изображение'
                                            : message.reply_content_type === 'file'
                                                ? '📎 Файл'
                                                : message.reply_content}
                                </div>
                            </div>
                        )}

                        {/* Текст */}
                        {message.content && (
                            <div
                                className={`whitespace-pre-wrap break-words ${
                                    emojiInfo.isEmojiOnly ? emojiSizeClass : ''
                                }`}
                            >
                                {message.content}
                            </div>
                        )}

                        {/* Изображения */}
                        {images.length > 0 && (
                            <div
                                className={`grid gap-1 mt-1.5 ${
                                    images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                                }`}
                            >
                                {images.map((a) => (
                                    <ImagePreview
                                        key={a.id}
                                        attachment={a}
                                        onClick={() => setOpenImage(a)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Файлы */}
                        {files.length > 0 && (
                            <div className="space-y-1 mt-1.5">
                                {files.map((a) => (
                                    <FileRow key={a.id} attachment={a} isOwn={isOwn} />
                                ))}
                            </div>
                        )}

                        {/* Подвал: изменено · время · галочки */}
                        <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isOwn ? 'text-white/80' : 'text-slate-400'
                            }`}
                        >
                            {message.edited_at && <span>изменено</span>}
                            <span>{time}</span>

                            {isOwn && readInfo && (
                                <>
                                    {isGroupOrChannel ? (
                                        <button
                                            type="button"
                                            onClick={() => setReadersOpen(true)}
                                            className="hover:opacity-80 leading-none"
                                            title={`Прочитано: ${readInfo.readCount}/${readInfo.total}. Нажмите, чтобы увидеть кто`}
                                        >
                                            {readInfo.allRead ? (
                                                <CheckCheck className="h-3 w-3" />
                                            ) : (
                                                <Check className="h-3 w-3" />
                                            )}
                                        </button>
                                    ) : (
                                        <span
                                            className="leading-none"
                                            title={readInfo.allRead ? 'Прочитано' : 'Отправлено'}
                                        >
                      {readInfo.allRead ? (
                          <CheckCheck className="h-3 w-3" />
                      ) : (
                          <Check className="h-3 w-3" />
                      )}
                    </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Кнопка ⋮ справа от пузыря — только для чужих */}
                    {!isOwn && actionButton}
                </div>
            </div>

            {/* Полноэкранный просмотр картинки */}
            {openImage && (
                <ImageViewer
                    attachment={openImage}
                    onClose={() => setOpenImage(null)}
                />
            )}

            {/* Список прочитавших */}
            <MessageReadersDialog
                open={readersOpen}
                onOpenChange={setReadersOpen}
                messageId={message.id}
            />

            {/* Удаление */}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Сообщение будет удалено у всех участников. Это действие
                            необратимо.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteMessage.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteMessage.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

// ============================================================
// Превью картинки
// ============================================================
const ImagePreview = ({ attachment, onClick }) => {
    const url = useAttachmentBlob(attachment.id, 'preview');
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative rounded-lg overflow-hidden bg-slate-200 hover:opacity-90 transition-opacity aspect-square max-h-48"
        >
            {url ? (
                <img
                    src={url}
                    alt={attachment.original_name}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                </div>
            )}
        </button>
    );
};

// ============================================================
// Строка файла
// ============================================================
const FileRow = ({ attachment, isOwn }) => {
    const kind = getFileIcon(attachment.mime_type, attachment.original_name);
    const Icon = ICONS[kind] || FileIcon;
    const colorClass = ICON_COLORS[kind] || ICON_COLORS.file;
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (downloading) return;
        setDownloading(true);
        try {
            await downloadAttachment(attachment.id, attachment.original_name);
        } catch (err) {
            alert(err.message || 'Не удалось скачать файл');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            title={attachment.original_name}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left min-w-0 max-w-[250px] ${
                isOwn
                    ? 'bg-white/15 hover:bg-white/25'
                    : 'bg-slate-100 hover:bg-slate-200'
            } ${downloading ? 'opacity-60' : ''}`}
        >
            <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
            >
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                    {attachment.original_name}
                </div>
                <div
                    className={`text-[10px] ${
                        isOwn ? 'text-white/70' : 'text-slate-400'
                    }`}
                >
                    {formatFileSize(attachment.size)}
                </div>
            </div>
            {downloading ? (
                <Loader2
                    className={`h-3.5 w-3.5 flex-shrink-0 animate-spin ${
                        isOwn ? 'text-white/70' : 'text-slate-400'
                    }`}
                />
            ) : (
                <Download
                    className={`h-3.5 w-3.5 flex-shrink-0 ${
                        isOwn ? 'text-white/70' : 'text-slate-400'
                    }`}
                />
            )}
        </button>
    );
};
export default MessageBubble;