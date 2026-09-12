import { useEffect, useRef, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Users,
    Hash,
    MessageSquare,
    Bookmark,
    Pin,
    MoreVertical,
    Settings as SettingsIcon,
    Trash2,
    LogOut,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import {
    useConversation,
    useMessages,
    useMarkAsRead,
    useMembers,
    useDeleteChannel,
    useLeaveConversation,
} from '../../hooks/useChat';
import { usePermissions } from '../../hooks/usePermissions';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatMembersPanel from './ChatMembersPanel';
import EditChannelDialog from './EditChannelDialog';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import AvatarView from './AvatarView';
import { useAuth } from '../../context/AuthContext';


const formatDayLabel = (date) => {
    const d = new Date(date);
    if (isToday(d)) return 'Сегодня';
    if (isYesterday(d)) return 'Вчера';
    return format(d, 'd MMMM yyyy', { locale: ru });
};

const ChatWindow = ({ conversationId, onBack, isVisible = true }) => {
    const { data: conversation } = useConversation(conversationId);
    const { data: members } = useMembers(conversationId);
    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMessages(conversationId);
    const markAsRead = useMarkAsRead();
    const deleteChannel = useDeleteChannel();
    const leaveConversation = useLeaveConversation();
    const { has } = usePermissions();

    const scrollRef = useRef(null);
    const bottomRef = useRef(null);

    const [replyTo, setReplyTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [membersOpen, setMembersOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);

    // Плоский список сообщений
    const messages = useMemo(() => {
        if (!data?.pages) return [];
        return [...data.pages].reverse().flatMap((page) => page.messages);
    }, [data]);

    // Группировка по датам
    const grouped = useMemo(() => {
        const groups = [];
        let lastDate = null;
        for (const m of messages) {
            const d = new Date(m.created_at);
            if (!lastDate || !isSameDay(lastDate, d)) {
                groups.push({ type: 'day', date: m.created_at, key: `day-${m.id}` });
                lastDate = d;
            }
            groups.push({ type: 'message', message: m, key: m.id });
        }
        return groups;
    }, [messages]);

    // Скролл вниз при первом открытии и при новых сообщениях
    const prevLenRef = useRef(0);
    useEffect(() => {
        if (!scrollRef.current) return;
        const el = scrollRef.current;
        const isFirst = prevLenRef.current === 0;
        const wasAtBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 200;

        if (isFirst || wasAtBottom) {
            requestAnimationFrame(() => {
                bottomRef.current?.scrollIntoView({
                    behavior: isFirst ? 'auto' : 'smooth',
                });
            });
        }
        prevLenRef.current = messages.length;
    }, [messages.length]);

    // Скролл вверх — подгрузка
    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        if (el.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
            const prevHeight = el.scrollHeight;
            fetchNextPage().then(() => {
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight - prevHeight;
                });
            });
        }
    };

// Отметка прочтения: только когда чат реально виден
    useEffect(() => {
        if (!isVisible) return;
        if (!messages.length) return;
        const last = messages[messages.length - 1];
        if (last && !last.deleted_at) {
            markAsRead.mutate({ id: conversationId, messageId: last.id });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, conversationId, isVisible]);

    // ---------- Флаги доступа ----------
    const isChannel = conversation?.type === 'channel';
    const isSaved = conversation?.type === 'saved';
    const isDirect = conversation?.type === 'direct';
    const isReadonly = conversation?.is_readonly;
    const myRole = conversation?.my_role;
    const isAdmin = myRole === 'admin';
    const canWrite = !isReadonly || isAdmin;

    const canUpdate = isChannel && (isAdmin || has('chat.update_channel'));
    const canDelete =
        isChannel &&
        !conversation?.is_system &&
        (isAdmin || has('chat.delete_channel'));

    // Участники — только для каналов и групп
    const showMembersButton = isChannel;

    // Меню действий:
    // - канал: настройки/удаление
    // - direct: удалить чат (выйти)
    const showActionsMenu = canUpdate || canDelete || isDirect;

    const HeaderIcon = isSaved ? Bookmark : isChannel ? Hash : MessageSquare;
    const membersCount = members?.length || 0;

    return (
        <div className="flex flex-col h-full">
            {/* Шапка */}
            <div className="h-14 flex items-center px-3 border-b border-slate-200 flex-shrink-0 gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 w-8 p-0 flex-shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <HeaderAvatar
                        conversation={conversation}
                        members={members}
                        fallbackIcon={HeaderIcon}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-800 truncate">
                            {conversation?.name || 'Чат'}
                        </div>
                        {isChannel && (
                            <div className="text-xs text-slate-400">
                                {membersCount}{' '}
                                {membersCount === 1
                                    ? 'участник'
                                    : membersCount >= 2 && membersCount <= 4
                                        ? 'участника'
                                        : 'участников'}
                                {isReadonly && ' · только чтение'}
                            </div>
                        )}
                        {isDirect && (
                            <div className="text-xs text-slate-400">личный чат</div>
                        )}
                    </div>
                    {conversation?.is_pinned && (
                        <Pin className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                    )}
                </div>

                {/* Кнопка "Участники" — только для каналов */}
                {showMembersButton && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMembersOpen(true)}
                        className="h-8 w-8 p-0 flex-shrink-0"
                        title="Участники"
                    >
                        <Users className="h-4 w-4" />
                    </Button>
                )}

                {/* Меню действий */}
                {showActionsMenu && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 flex-shrink-0"
                            >
                                <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {canUpdate && (
                                <DropdownMenuItem
                                    icon={SettingsIcon}
                                    onClick={() => setEditOpen(true)}
                                >
                                    Настройки канала
                                </DropdownMenuItem>
                            )}
                            {canDelete && (
                                <>
                                    {canUpdate && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                        icon={Trash2}
                                        danger
                                        onClick={() => setConfirmDelete(true)}
                                    >
                                        Удалить канал
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isDirect && (
                                <DropdownMenuItem
                                    icon={LogOut}
                                    danger
                                    onClick={() => setConfirmLeave(true)}
                                >
                                    Удалить чат
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Сообщения */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 py-4 bg-slate-50"
            >
                {isFetchingNextPage && (
                    <div className="flex justify-center py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                        <MessageSquare className="h-10 w-10 mb-2 text-slate-300" />
                        <p>Нет сообщений</p>
                        <p className="text-xs mt-1">Напишите первым!</p>
                    </div>
                ) : (
                    grouped.map((item) => {
                        if (item.type === 'day') {
                            return (
                                <div
                                    key={item.key}
                                    className="flex items-center justify-center my-3"
                                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
                    {formatDayLabel(item.date)}
                  </span>
                                </div>
                            );
                        }
                        return (
                            <MessageBubble
                                key={item.key}
                                message={item.message}
                                conversation={conversation}
                                members={members}
                                onReply={(m) => setReplyTo(m)}
                                onEdit={(m) => setEditingMessage(m)}
                            />
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Ввод */}
            {canWrite ? (
                <MessageInput
                    conversationId={conversationId}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    editingMessage={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                />
            ) : (
                <div className="h-12 flex items-center justify-center border-t border-slate-200 text-xs text-slate-400 bg-white">
                    Канал работает в режиме только для чтения
                </div>
            )}

            {/* Панель участников (только каналы) */}
            <ChatMembersPanel
                open={membersOpen}
                onOpenChange={setMembersOpen}
                conversationId={conversationId}
            />

            {/* Редактирование канала (только каналы) */}
            {isChannel && (
                <EditChannelDialog
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    conversation={conversation}
                />
            )}

            {/* Удаление канала */}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить канал?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Канал «{conversation?.name}» и все его сообщения будут удалены
                            навсегда. Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                deleteChannel.mutate(conversationId, {
                                    onSuccess: () => {
                                        setConfirmDelete(false);
                                        onBack();
                                    },
                                })
                            }
                            disabled={deleteChannel.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteChannel.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Выход из личного чата (удаление из своего списка) */}
            <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Чат исчезнет из вашего списка. У собеседника он останется, и он
                            сможет написать вам снова.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                leaveConversation.mutate(conversationId, {
                                    onSuccess: () => {
                                        setConfirmLeave(false);
                                        onBack();
                                    },
                                })
                            }
                            disabled={leaveConversation.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {leaveConversation.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
// ============================================================
// Аватар в шапке чата
// Приоритет:
//   1) Если у conversation.avatar_url есть (канал с аватаром) — показываем
//   2) Если direct — берём аватар собеседника из members
//   3) Иначе — иконка (Hash / Bookmark / MessageSquare)
// ============================================================
const HeaderAvatar = ({ conversation, members, fallbackIcon: Icon }) => {
    const { user } = useAuth();
    const isDirect = conversation?.type === 'direct';

    // Для direct — ищем собеседника
    const peer =
        isDirect && members
            ? members.find((m) => m.user_id !== user?.id)
            : null;

    const avatar = conversation?.avatar_url || peer?.avatar_url || null;

    if (avatar) {
        return <AvatarView avatar={avatar} name={conversation?.name} size={32} />;
    }

    // Иначе — стандартный кружок с иконкой
    return (
        <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4" />
        </div>
    );
};
export default ChatWindow;