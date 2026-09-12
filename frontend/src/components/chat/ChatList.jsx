import { useState, useMemo } from 'react';
import {
    useConversations,
    usePinConversation,
    useChattableUsers,
    useCreateDirect,
} from '../../hooks/useChat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    Pin,
    Hash,
    MessageSquare,
    Bookmark,
    Loader2,
    Plus,
    Users,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import CreateChannelDialog from './CreateChannelDialog';
import AvatarView from './AvatarView';

const ChatList = ({ filter = 'all', onSelect }) => {
    const { has } = usePermissions();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);

    const serverFilter =
        filter === 'channels' ? 'channels' : filter === 'chats' ? 'chats' : 'all';

    const { data: conversations, isLoading } = useConversations(serverFilter);
    // Пользователей грузим только в табе "Чаты" и "Все чаты"
    const showUsers = filter === 'chats' || filter === 'all';
    const { data: usersData, isLoading: usersLoading } = useChattableUsers(
        showUsers ? search : ''
    );
    const pin = usePinConversation();
    const createDirect = useCreateDirect();

    const filteredConversations = useMemo(() => {
        const list = conversations || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter((c) => (c.name || '').toLowerCase().includes(q));
    }, [conversations, search]);

    // Пользователей фильтруем: исключаем тех, с кем уже есть direct-чат
    // (они уже в списке conversations)
    const usersToStartChat = useMemo(() => {
        if (!showUsers || !usersData) return [];
        return usersData.filter((u) => !u.direct_conversation_id);
    }, [usersData, showUsers]);

    const handlePin = (e, conv) => {
        e.stopPropagation();
        pin.mutate({ id: conv.id, pinned: !conv.is_pinned });
    };

    const handleStartChat = (userId) => {
        createDirect.mutate(userId, {
            onSuccess: (data) => {
                if (data?.id) onSelect(data.id);
            },
        });
    };

    const nothingToShow =
        filteredConversations.length === 0 && usersToStartChat.length === 0;

    return (
        <div className="flex flex-col h-full">
            {/* Поиск + кнопка создания канала */}
            <div className="p-3 border-b border-slate-100 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder={
                            filter === 'chats'
                                ? 'Поиск чатов или пользователей...'
                                : 'Поиск чатов...'
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 rounded-lg text-sm"
                    />
                </div>
                {has('chat.create_channel') && filter === 'channels' && (
                    <Button
                        size="sm"
                        onClick={() => setDialogOpen(true)}
                        className="h-9 w-9 p-0 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                        title="Создать канал"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Список */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    </div>
                ) : nothingToShow ? (
                    <div className="text-center text-slate-400 text-sm py-12 px-6">
                        {search ? 'Ничего не найдено' : 'Нет чатов'}
                    </div>
                ) : (
                    <>
                        {/* Существующие разговоры */}
                        {filteredConversations.length > 0 && (
                            <div className="divide-y divide-slate-100">
                                {filteredConversations.map((conv) => (
                                    <ConversationRow
                                        key={conv.id}
                                        conv={conv}
                                        onClick={() => onSelect(conv.id)}
                                        onPin={(e) => handlePin(e, conv)}
                                        canPin
                                    />
                                ))}
                            </div>
                        )}

                        {/* Раздел "Все пользователи" */}
                        {showUsers && usersToStartChat.length > 0 && (
                            <>
                                <div className="px-3 py-2 bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                        <Users className="h-3 w-3" />
                                        Все пользователи
                                        <span className="text-slate-400 font-normal normal-case tracking-normal">
                      ({usersToStartChat.length})
                    </span>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {usersToStartChat.map((user) => (
                                        <UserRow
                                            key={user.id}
                                            user={user}
                                            onClick={() => handleStartChat(user.id)}
                                            loading={createDirect.isPending}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Если пользователи ещё грузятся */}
                        {showUsers && usersLoading && usersToStartChat.length === 0 && (
                            <div className="flex justify-center items-center h-16">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                            </div>
                        )}
                    </>
                )}
            </div>

            <CreateChannelDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
};

// ============================================================
// Строка разговора
// ============================================================
const ConversationRow = ({ conv, onClick, onPin, canPin }) => {
    const isChannel = conv.type === 'channel';
    const isSaved = conv.type === 'saved';
    const Icon = isSaved ? Bookmark : isChannel ? Hash : MessageSquare;

    const lastMsgPreview = (() => {
        if (!conv.last_message_id) return 'Нет сообщений';
        if (conv.last_message_type === 'image') return '📷 Изображение';
        if (conv.last_message_type === 'file') return '📎 Файл';
        const text = conv.last_message_content || '';
        return text.length > 40 ? text.slice(0, 40) + '…' : text;
    })();

    const sender = conv.last_message_display_name || conv.last_message_username;
    const time = conv.last_message_created_at
        ? formatDistanceToNow(new Date(conv.last_message_created_at), {
            addSuffix: false,
            locale: ru,
        })
        : '';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className="w-full text-left px-3 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer outline-none focus:bg-slate-50"
        >
            <div className="flex-shrink-0">
                {conv.avatar_url ? (
                    <AvatarView avatar={conv.avatar_url} name={conv.name} size={40} />
                ) : (
                    <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isSaved
                                ? 'bg-purple-100 text-purple-600'
                                : isChannel
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-blue-100 text-blue-600'
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    {conv.is_pinned && <Pin className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                    <span className="font-medium text-sm text-slate-800 truncate">
            {conv.name || 'Без названия'}
          </span>
                    {conv.is_readonly && (
                        <span className="text-[10px] text-slate-400">(только чтение)</span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    {sender && <span className="truncate max-w-[100px]">{sender}:</span>}
                    <span className="truncate flex-1">{lastMsgPreview}</span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1">
                    {time && <span className="text-[10px] text-slate-400">{time}</span>}
                    {canPin && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin(e);
                            }}
                            className={`p-0.5 rounded hover:bg-slate-200 ${
                                conv.is_pinned ? 'text-orange-500' : 'text-slate-300'
                            }`}
                            title={conv.is_pinned ? 'Открепить' : 'Закрепить'}
                        >
                            <Pin className="h-3 w-3" />
                        </button>
                    )}
                </div>
                {conv.unread_count > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-orange-500 text-white text-[10px]">
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </Badge>
                )}
            </div>
        </div>
    );
};

// ============================================================
// Строка пользователя (для старта нового чата)
// ============================================================
const UserRow = ({ user, onClick, loading }) => {
    const name = user.display_name || user.username;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={loading ? undefined : onClick}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !loading) {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={`w-full text-left px-3 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 cursor-pointer outline-none focus:bg-slate-50 ${
                loading ? 'opacity-60 cursor-wait' : ''
            }`}
        >
            <AvatarView avatar={user.avatar_url} name={name} size={40} />

            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-800 truncate">
                    {name}
                </div>
                <div className="text-xs text-slate-400 truncate">
                    @{user.username}
                </div>
            </div>

            <MessageSquare className="h-4 w-4 text-slate-300 flex-shrink-0" />
        </div>
    );
};

export default ChatList;