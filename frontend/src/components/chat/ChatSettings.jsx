import { useState, useEffect, useRef } from 'react';
import { useChatProfile, useUpdateChatProfile } from '../../hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User as UserIcon,MessageCircle, Camera, Check, AlertTriangle,Volume2, VolumeX  } from 'lucide-react';
import { uploadChatAvatar } from '../../api/chat';
import { getConversations } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import AvatarView from './AvatarView';
import {
    isFloatingButtonEnabled,
    setFloatingButtonEnabled,
} from '../../lib/chatUiPrefs';

import { isSoundEnabled, setSoundEnabled, playNotificationSound } from '../../lib/notificationSound';
const ChatSettings = () => {
    const [floatingButton, setFloatingButton] = useState(isFloatingButtonEnabled());

    const handleFloatingToggle = () => {
        const next = !floatingButton;
        setFloatingButton(next);
        setFloatingButtonEnabled(next);
    };
    const { user } = useAuth();
    const [soundOn, setSoundOn] = useState(isSoundEnabled());

    const handleSoundToggle = () => {
        const next = !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
        // Проиграем для проверки, если включаем
        if (next) playNotificationSound();
    };
    const { data: profile, isLoading } = useChatProfile();
    const update = useUpdateChatProfile();

    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setAvatarUrl(profile.avatar_url || null);
        }
    }, [profile]);

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
            const convs = await getConversations('chats');
            const savedConv = convs.data.find((c) => c.type === 'saved');
            if (!savedConv) throw new Error('Не найдено "Избранное"');

            const res = await uploadChatAvatar(savedConv.id, file);
            const attachmentId = res.data[0].id;
            setAvatarUrl(attachmentId); // ← сохраняем id, а не URL!
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки аватара');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = () => {
        setError('');
        setSuccess('');
        update.mutate(
            {
                display_name: displayName.trim() || null,
                avatar_url: avatarUrl,
            },
            {
                onSuccess: () => {
                    setSuccess('Профиль сохранён');
                    setTimeout(() => setSuccess(''), 3000);
                },
                onError: (err) => {
                    setError(err.response?.data?.error || 'Ошибка сохранения');
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
        );
    }

    const initial = (displayName || user?.username || '?').charAt(0).toUpperCase();

    return (
        <div className="p-4 overflow-y-auto h-full space-y-6">
            {/* Аватар */}
            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <AvatarView
                        avatar={avatarUrl}
                        name={displayName || user?.username}
                        size={96}
                        textClassName="text-3xl"
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
                <div className="text-center">
                    <div className="text-sm font-medium text-slate-700">
                        {displayName || user?.username}
                    </div>
                    <div className="text-xs text-slate-400">
                        Логин: {user?.username}
                    </div>
                </div>
            </div>

            {/* Имя в чате */}
            <div className="space-y-2">
                <Label htmlFor="display_name" className="text-sm font-medium text-slate-700">
                    Имя в чате
                </Label>
                <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={user?.username}
                    maxLength={100}
                    className="rounded-lg"
                />
                <p className="text-xs text-slate-400">
                    Так вас будут видеть другие участники чата
                </p>
            </div>

            {/* Сообщения */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-200 flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0" />
                    {success}
                </div>
            )}
            {/* Плавающая кнопка чата */}
            <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <MessageCircle
                            className={`h-4 w-4 flex-shrink-0 ${
                                floatingButton ? 'text-orange-500' : 'text-slate-400'
                            }`}
                        />
                        <div>
                            <div className="text-sm font-medium text-slate-800">
                                Кнопка чата в углу
                            </div>
                            <div className="text-xs text-slate-500">
                                Плавающая кнопка в правом нижнем углу. Кнопка в верхнем меню
                                остаётся всегда.
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleFloatingToggle}
                        role="switch"
                        aria-checked={floatingButton}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                            floatingButton ? 'bg-orange-500' : 'bg-slate-300'
                        }`}
                    >
      <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              floatingButton ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
                    </button>
                </div>
            </div>
            {/* Звук уведомлений */}
            <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        {soundOn ? (
                            <Volume2 className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        ) : (
                            <VolumeX className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                        <div>
                            <div className="text-sm font-medium text-slate-800">
                                Звук уведомлений
                            </div>
                            <div className="text-xs text-slate-500">
                                Проигрывать звук при новом сообщении
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSoundToggle}
                        role="switch"
                        aria-checked={soundOn}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                            soundOn ? 'bg-orange-500' : 'bg-slate-300'
                        }`}
                    >
      <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              soundOn ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
                    </button>
                </div>
            </div>
            {/* Кнопка */}
            <Button
                onClick={handleSave}
                disabled={update.isPending}
                className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
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

            <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                Изменения профиля будут видны во всех чатах и каналах
            </div>
        </div>
    );
};

export default ChatSettings;