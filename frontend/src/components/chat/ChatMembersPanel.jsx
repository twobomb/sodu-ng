import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    Users,
    UserPlus,
    Trash2,
    Loader2,
    ArrowLeft,
    Crown,
} from 'lucide-react';
import AvatarView from './AvatarView';
import {
    useMembers,
    useAddMember,
    useRemoveMember,
    useInvitableUsers,
    useConversation,
    useTransferAdmin,
} from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import DisplayName from './DisplayName';
const ChatMembersPanel = ({ open, onOpenChange, conversationId }) => {
    const { user } = useAuth();
    const { has } = usePermissions();
    const [mode, setMode] = useState('list'); // 'list' | 'add'
    const [search, setSearch] = useState('');
    const [addSearch, setAddSearch] = useState('');

    const { data: conversation } = useConversation(conversationId);
    const { data: members, isLoading } = useMembers(conversationId);
    const { data: invitable, isLoading: invitableLoading } = useInvitableUsers(
        conversationId,
        addSearch,
        mode === 'add'
    );

    const addMember = useAddMember(conversationId);
    const removeMember = useRemoveMember(conversationId);
    const transferAdmin = useTransferAdmin(conversationId);

    const myRole = conversation?.my_role;
    const isAdmin = myRole === 'admin';
    const canManage = has('chat.manage_members');
    const canInvite =
        conversation?.allow_member_invites || isAdmin || canManage;

    const filteredMembers = useMemo(() => {
        if (!members) return [];
        if (!search.trim()) return members;
        const q = search.toLowerCase();
        return members.filter(
            (m) =>
                m.username.toLowerCase().includes(q) ||
                (m.display_name || '').toLowerCase().includes(q)
        );
    }, [members, search]);

    const handleAdd = (userId) => {
        addMember.mutate({ userId, role: 'member' });
    };

    const handleRemove = (memberId) => {
        if (!confirm('Удалить этого участника из чата?')) return;
        removeMember.mutate(memberId);
    };

    const handleTransferAdmin = (member) => {
        const name = member.display_name || member.username;
        if (
            !confirm(
                `Передать права администратора пользователю «${name}»?\n\nВы станете обычным участником.`
            )
        )
            return;
        transferAdmin.mutate(member.user_id);
    };

    const handleClose = () => {
        setMode('list');
        setSearch('');
        setAddSearch('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        {mode === 'add' && (
                            <button
                                type="button"
                                onClick={() => setMode('list')}
                                className="h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                        )}
                        {mode === 'list' ? (
                            <>
                                <Users className="h-5 w-5 text-orange-500" />
                                Участники ({members?.length || 0})
                            </>
                        ) : (
                            <>
                                <UserPlus className="h-5 w-5 text-orange-500" />
                                Добавить участников
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {mode === 'list' ? (
                    <>
                        {/* Поиск + кнопка добавить */}
                        <div className="flex gap-2 flex-shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Поиск участников..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-9 rounded-lg text-sm"
                                />
                            </div>
                            {canInvite && (
                                <Button
                                    size="sm"
                                    onClick={() => setMode('add')}
                                    className="h-9 w-9 p-0 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                                    title="Добавить участника"
                                >
                                    <UserPlus className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Список участников */}
                        <div className="flex-1 overflow-y-auto -mx-6 px-6">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                                </div>
                            ) : filteredMembers.length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-8">
                                    Никого не найдено
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredMembers.map((m) => {
                                        const isMe = m.user_id === user?.id;
                                        const memberIsAdmin = m.role === 'admin';

                                        // Можно ли удалить этого участника
                                        const canRemoveThis =
                                            !isMe &&
                                            (isAdmin || canManage) &&
                                            conversation?.type !== 'saved' &&
                                            conversation?.type !== 'direct';

                                        // Можно ли передать этому участнику админку
                                        const canTransferTo =
                                            !isMe &&
                                            isAdmin &&
                                            !memberIsAdmin &&
                                            conversation?.type !== 'saved' &&
                                            conversation?.type !== 'direct';

                                        return (
                                            <div
                                                key={m.user_id}
                                                className="flex items-center gap-3 py-2.5"
                                            >
                                                <AvatarView
                                                    avatar={m.avatar_url}
                                                    name={m.display_name || m.username}
                                                    size={36}
                                                />

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <DisplayName
                                                                name={m.display_name || m.username}
                                                                role={m.user_role}
                                                                size="md"
                                                            />
                                                            {isMe && (
                                                                <span className="text-[10px] text-slate-400">(вы)</span>
                                                            )}
                                                            {memberIsAdmin && (
                                                                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        {isMe && (
                                                            <span className="text-[10px] text-slate-400">
                                (вы)
                              </span>
                                                        )}
                                                        {memberIsAdmin && (
                                                            <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate">
                                                        @{m.username}
                                                    </div>
                                                </div>

                                                {/* Кнопки действий */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {canTransferTo && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTransferAdmin(m)}
                                                            disabled={transferAdmin.isPending}
                                                            className="h-7 w-7 rounded-full hover:bg-amber-50 text-amber-500 flex items-center justify-center disabled:opacity-50"
                                                            title="Передать права администратора"
                                                        >
                                                            <Crown className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    {canRemoveThis && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemove(m.user_id)}
                                                            disabled={removeMember.isPending}
                                                            className="h-7 w-7 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center disabled:opacity-50"
                                                            title="Удалить из чата"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Поиск в режиме добавления */}
                        <div className="relative flex-shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Поиск пользователей..."
                                value={addSearch}
                                onChange={(e) => setAddSearch(e.target.value)}
                                autoFocus
                                className="pl-9 h-9 rounded-lg text-sm"
                            />
                        </div>

                        {/* Список доступных пользователей */}
                        <div className="flex-1 overflow-y-auto -mx-6 px-6">
                            {invitableLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                                </div>
                            ) : !invitable?.length ? (
                                <div className="text-center text-slate-400 text-sm py-8">
                                    {addSearch ? 'Никого не найдено' : 'Все уже в чате'}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {invitable.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex items-center gap-3 py-2.5"
                                        >
                                            <AvatarView
                                                avatar={u.avatar_url}
                                                name={u.display_name || u.username}
                                                size={36}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-800 truncate">
                                                    {u.display_name || u.username}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">
                                                    @{u.username}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAdd(u.id)}
                                                disabled={addMember.isPending}
                                                className="rounded-lg h-8 px-2.5 text-xs"
                                            >
                                                <UserPlus className="h-3.5 w-3.5 mr-1" />
                                                Добавить
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ChatMembersPanel;