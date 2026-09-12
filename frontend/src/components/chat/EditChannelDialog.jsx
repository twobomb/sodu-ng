import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Settings as SettingsIcon, Camera } from 'lucide-react';
import { useUpdateChannel } from '../../hooks/useChat';
import { uploadChatAvatar } from '../../api/chat';
import AvatarView from './AvatarView';

const EditChannelDialog = ({ open, onOpenChange, conversation }) => {
    const update = useUpdateChannel();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isReadonly, setIsReadonly] = useState(false);
    const [allowInvites, setAllowInvites] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (conversation) {
            setName(conversation.name || '');
            setDescription(conversation.description || '');
            setIsReadonly(!!conversation.is_readonly);
            setAllowInvites(conversation.allow_member_invites !== false);
            setAvatarUrl(conversation.avatar_url || null);
        }
        setError('');
    }, [conversation, open]);

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Можно загрузить только изображение');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Аватар не должен превышать 5 МБ');
            return;
        }

        setError('');
        setUploading(true);
        try {
            const res = await uploadChatAvatar(conversation.id, file);
            const attachmentId = res.data[0].id;
            setAvatarUrl(attachmentId);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки аватара');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        update.mutate(
            {
                id: conversation.id,
                data: {
                    name: name.trim(),
                    description: description.trim() || null,
                    is_readonly: isReadonly,
                    allow_member_invites: allowInvites,
                    avatar_url: avatarUrl,
                },
            },
            {
                onSuccess: () => onOpenChange(false),
                onError: (err) =>
                    setError(err.response?.data?.error || 'Ошибка сохранения'),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <SettingsIcon className="h-5 w-5 text-orange-500" />
                        Настройки канала
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Аватар */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                                <AvatarView
                                    avatar={avatarUrl}
                                    name={name}
                                    size={88}
                                    textClassName="text-2xl"
                                    className="border-4 border-white shadow-lg"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md transition-colors"
                                    title="Загрузить аватар"
                                >
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Camera className="h-4 w-4" />
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={handleAvatarUpload}
                                />
                            </div>
                            <p className="text-xs text-slate-400">Аватар канала (необязательно)</p>
                        </div>

                        {/* Название */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Название</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="rounded-lg"
                            />
                        </div>

                        {/* Описание */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Описание</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Необязательно"
                                className="rounded-lg"
                            />
                        </div>

                        {/* Только чтение */}
                        <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3">
                            <input
                                type="checkbox"
                                checked={isReadonly}
                                onChange={(e) => setIsReadonly(e.target.checked)}
                                className="h-4 w-4 mt-0.5 rounded accent-orange-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">
                                    Только чтение
                                </div>
                                <div className="text-xs text-slate-500">
                                    Писать смогут только администраторы канала
                                </div>
                            </div>
                        </label>

                        {/* Разрешить приглашать */}
                        <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3">
                            <input
                                type="checkbox"
                                checked={allowInvites}
                                onChange={(e) => setAllowInvites(e.target.checked)}
                                className="h-4 w-4 mt-0.5 rounded accent-orange-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">
                                    Разрешить участникам приглашать
                                </div>
                                <div className="text-xs text-slate-500">
                                    Обычные участники смогут добавлять новых людей
                                </div>
                            </div>
                        </label>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={update.isPending || uploading || !name.trim()}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {update.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                'Сохранить'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditChannelDialog;