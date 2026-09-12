import { useState, useRef, useEffect } from 'react';
import {
    Send,
    Paperclip,
    Smile,
    X,
    Loader2,
    Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSendMessage, useEditMessage } from '../../hooks/useChat';
import { uploadFiles } from '../../api/chat';
import { formatFileSize, getFileIcon } from '../../lib/attachmentUrl';
import EmojiPicker from './EmojiPicker';

const MessageInput = ({
                          conversationId,
                          replyTo,
                          onCancelReply,
                          editingMessage,
                          onCancelEdit,
                      }) => {
    const [text, setText] = useState('');
    const [files, setFiles] = useState([]); // { file, preview }
    const [showEmoji, setShowEmoji] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    // Синхронный флаг — защита от двойного Enter до того, как setState применится
    const sendingRef = useRef(false);

    const send = useSendMessage(conversationId);
    const edit = useEditMessage(conversationId);

    // Фокус при монтировании
    useEffect(() => {
        textareaRef.current?.focus();
    }, [conversationId]);

    // Заполнение при редактировании
    useEffect(() => {
        if (editingMessage) {
            setText(editingMessage.content || '');
            textareaRef.current?.focus();
        }
    }, [editingMessage]);

    // Автовысота textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }, [text]);

    const handleFiles = (fileList) => {
        const arr = Array.from(fileList);
        const newItems = arr.map((f) => ({
            file: f,
            preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        }));
        setFiles((prev) => [...prev, ...newItems]);
    };

    const removeFile = (idx) => {
        setFiles((prev) => {
            const f = prev[idx];
            if (f.preview) URL.revokeObjectURL(f.preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleSubmit = async () => {
        // Синхронная защита от двойного клика/Enter
        if (sendingRef.current || uploading) return;
        if (send.isPending) return;

        const trimmed = text.trim();
        if (!trimmed && files.length === 0) return;

        setUploadError('');

        // ---------- Режим редактирования ----------
        if (editingMessage) {
            sendingRef.current = true;
            setIsSending(true);
            const content = trimmed;

            edit.mutate(
                { messageId: editingMessage.id, content },
                {
                    onSuccess: () => {
                        setText('');
                        onCancelEdit();
                    },
                    onSettled: () => {
                        sendingRef.current = false;
                        setIsSending(false);
                    },
                }
            );
            return;
        }

        // ---------- Обычная отправка ----------
        // Забираем снимок состояния и СРАЗУ очищаем поля,
        // чтобы повторный Enter не отправил дубль.
        const textToSend = trimmed;
        const filesToSend = files;

        sendingRef.current = true;
        setIsSending(true);
        setText('');
        setFiles([]);

        let attachmentIds = [];

        try {
            // Загрузка файлов
            if (filesToSend.length) {
                setUploading(true);
                try {
                    const res = await uploadFiles(
                        conversationId,
                        filesToSend.map((f) => f.file)
                    );
                    attachmentIds = res.data.map((a) => a.id);
                } catch (err) {
                    setUploadError(
                        err.response?.data?.error || 'Ошибка загрузки файлов'
                    );
                    // Возвращаем контент в поле, чтобы не потерять
                    setText(textToSend);
                    setFiles(filesToSend);
                    return;
                } finally {
                    setUploading(false);
                }
            }

            const contentType = filesToSend.some((f) =>
                f.file.type.startsWith('image/')
            )
                ? 'image'
                : filesToSend.length
                    ? 'file'
                    : 'text';

            await new Promise((resolve) => {
                send.mutate(
                    {
                        content: textToSend || null,
                        content_type: contentType,
                        reply_to_id: replyTo?.id || null,
                        attachment_ids: attachmentIds,
                    },
                    {
                        onSuccess: () => {
                            filesToSend.forEach(
                                (f) => f.preview && URL.revokeObjectURL(f.preview)
                            );
                            onCancelReply?.();
                            textareaRef.current?.focus();
                            resolve();
                        },
                        onError: (err) => {
                            // Возвращаем текст и файлы в поле
                            setUploadError(
                                err?.response?.data?.error ||
                                'Не удалось отправить сообщение'
                            );
                            setText(textToSend);
                            setFiles(filesToSend);
                            resolve();
                        },
                    }
                );
            });
        } finally {
            sendingRef.current = false;
            setIsSending(false);
            // Возвращаем фокус в поле ввода
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Дополнительная защита — если уже идёт отправка, ничего не делаем
            if (sendingRef.current || uploading || send.isPending) return;
            handleSubmit();
        }
        if (e.key === 'Escape') {
            if (editingMessage) onCancelEdit();
            if (replyTo) onCancelReply();
        }
    };

    const insertEmoji = (emoji) => {
        setText((prev) => prev + emoji);
        textareaRef.current?.focus();
    };

    const hasContent = text.trim() || files.length > 0;
    const busy = isSending || uploading || send.isPending;

    return (
        <div className="border-t border-slate-200 bg-white flex-shrink-0">
            {/* Ответ */}
            {replyTo && (
                <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex-1 min-w-0 pl-2 border-l-2 border-orange-400">
                        <div className="text-xs font-medium text-orange-600">
                            Ответ на {replyTo.display_name || replyTo.username}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {replyTo.content_type === 'image'
                                ? '📷 Изображение'
                                : replyTo.content_type === 'file'
                                    ? '📎 Файл'
                                    : replyTo.content}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancelReply}
                        className="h-6 w-6 rounded hover:bg-slate-200 flex items-center justify-center"
                    >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                </div>
            )}

            {/* Редактирование */}
            {editingMessage && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
                    <div className="flex-1 min-w-0 pl-2 border-l-2 border-amber-400">
                        <div className="text-xs font-medium text-amber-700">
                            Редактирование сообщения
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {editingMessage.content}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="h-6 w-6 rounded hover:bg-amber-100 flex items-center justify-center"
                    >
                        <X className="h-3.5 w-3.5 text-amber-700" />
                    </button>
                </div>
            )}

            {/* Превью файлов */}
            {files.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-2 border-b border-slate-100 pb-2">
                    {files.map((f, idx) => (
                        <div
                            key={idx}
                            className="relative group/file bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex items-center gap-2 w-[200px] min-w-0"
                            title={f.file.name}
                        >
                            {f.preview ? (
                                <img
                                    src={f.preview}
                                    alt=""
                                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                                    <Paperclip className="h-4 w-4 text-slate-500" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-800 truncate">
                                    {f.file.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {formatFileSize(f.file.size)}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="h-5 w-5 rounded-full bg-slate-300 hover:bg-red-500 text-white flex items-center justify-center flex-shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Ошибка загрузки */}
            {uploadError && (
                <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-b border-red-100">
                    {uploadError}
                </div>
            )}

            {/* Панель ввода */}
            <div className="flex items-end gap-1 px-2 py-2 relative">
                {/* Файлы */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || !!editingMessage}
                    className="h-9 w-9 p-0 flex-shrink-0"
                    title="Прикрепить файлы"
                >
                    <Paperclip className="h-4 w-4" />
                </Button>

                {/* Эмодзи */}
                <div className="relative flex-shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEmoji((v) => !v)}
                        disabled={busy}
                        className="h-9 w-9 p-0"
                        title="Смайлики"
                    >
                        <Smile className="h-4 w-4" />
                    </Button>
                    {showEmoji && (
                        <EmojiPicker
                            onSelect={insertEmoji}
                            onClose={() => setShowEmoji(false)}
                        />
                    )}
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={editingMessage ? 'Редактировать...' : 'Сообщение...'}
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent max-h-[120px]"
                />

                {/* Отправить */}
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!hasContent || busy}
                    className="h-9 w-9 p-0 flex-shrink-0 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                >
                    {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    );
};

export default MessageInput;