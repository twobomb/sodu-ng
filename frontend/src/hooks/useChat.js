import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
} from '@tanstack/react-query';
import * as api from '../api/chat';
export const useChatProfile = () =>
    useQuery({
        queryKey: ['chat', 'profile'],
        queryFn: () => api.getMyChatProfile().then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
export const useInvitableUsers = (conversationId, query = '', enabled = true) =>
    useQuery({
        queryKey: ['chat', 'invitable', conversationId, query],
        queryFn: () => api.getInvitableUsers(conversationId, query).then((r) => r.data),
        enabled: enabled && !!conversationId,
        staleTime: 30 * 1000,
    });

export const useAddMember = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, role = 'member' }) =>
            api.addMember(conversationId, userId, role),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'members', conversationId]);
            qc.invalidateQueries(['chat', 'invitable', conversationId]);
        },
    });
};
/**
 * Счётчики непрочитанных по категориям.
 * Использует тот же кеш, что и useConversations('all') — без лишних запросов.
 */
export const useChatUnreadCounts = () => {
    const { data } = useQuery({
        queryKey: ['chat', 'conversations', 'all'],
        queryFn: () => api.getConversations('all').then((r) => r.data),
        staleTime: 30 * 1000,
    });

    const conversations = data || [];

    const hasUnread = (c) => (c.unread_count || 0) > 0;

    return {
        total: conversations.filter(hasUnread).length,
        channels: conversations.filter((c) => c.type === 'channel' && hasUnread(c)).length,
        chats: conversations.filter(
            (c) => (c.type === 'direct' || c.type === 'saved') && hasUnread(c)
        ).length,
        // Сумма всех непрочитанных сообщений (если понадобится)
        totalMessages: conversations.reduce(
            (sum, c) => sum + (c.unread_count || 0),
            0
        ),
    };
};
export const useLeaveConversation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.leaveConversation(id),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};
export const useTransferAdmin = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId) => api.transferAdmin(conversationId, userId),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'members', conversationId]);
            qc.invalidateQueries(['chat', 'conversation', conversationId]);
        },
    });
};
export const useRemoveMember = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (memberId) => api.removeMember(conversationId, memberId),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'members', conversationId]);
            qc.invalidateQueries(['chat', 'invitable', conversationId]);
        },
    });
};
export const useUpdateChatProfile = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.updateMyChatProfile(data).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'profile']);
        },
    });
};
export const useChattableUsers = (query = '') =>
    useQuery({
        queryKey: ['chat', 'users', query],
        queryFn: () => api.getChattableUsers(query).then((r) => r.data),
        staleTime: 60 * 1000,
    });
export const useMessageReaders = (messageId, enabled = false) =>
    useQuery({
        queryKey: ['chat', 'readers', messageId],
        queryFn: () => api.getMessageReaders(messageId).then((r) => r.data),
        enabled: enabled && !!messageId,
    });
export const useConversations = (filter = 'all') =>
    useQuery({
        queryKey: ['chat', 'conversations', filter],
        queryFn: () => api.getConversations(filter).then((r) => r.data),
        staleTime: 30 * 1000,
    });

export const useConversation = (id) =>
    useQuery({
        queryKey: ['chat', 'conversation', id],
        queryFn: () => api.getConversation(id).then((r) => r.data),
        enabled: !!id,
    });

export const useMessages = (conversationId) =>
    useInfiniteQuery({
        queryKey: ['chat', 'messages', conversationId],
        queryFn: ({ pageParam }) =>
            api
                .getMessages(conversationId, {
                    before: pageParam?.created_at,
                    before_id: pageParam?.id,
                    limit: 30,
                })
                .then((r) => r.data),
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        enabled: !!conversationId,
        staleTime: 60 * 1000,
    });

export const useCreateChannel = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.createChannel(data).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useUpdateChannel = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) =>
            api.updateChannel(id, data).then((r) => r.data),
        onSuccess: (_, vars) => {
            qc.invalidateQueries(['chat', 'conversations']);
            qc.invalidateQueries(['chat', 'conversation', vars.id]);
        },
    });
};

export const useDeleteChannel = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.deleteChannel(id),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const usePinConversation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, pinned }) => api.pinConversation(id, pinned),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useSendMessage = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) =>
            api.sendMessage(conversationId, data).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useEditMessage = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ messageId, content }) => api.editMessage(messageId, content),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'messages', conversationId]);
        },
    });
};

export const useDeleteMessage = (conversationId) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (messageId) => api.deleteMessage(messageId),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'messages', conversationId]);
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useCreateDirect = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId) => api.createDirect(userId).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useMarkAsRead = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, messageId }) => api.markAsRead(id, messageId),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

// Отметить все чаты прочитанными
export const useMarkAllRead = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => api.markAllRead(),
        onSuccess: () => {
            qc.invalidateQueries(['chat', 'conversations']);
        },
    });
};

export const useMembers = (conversationId) =>
    useQuery({
        queryKey: ['chat', 'members', conversationId],
        queryFn: () => api.getMembers(conversationId).then((r) => r.data),
        enabled: !!conversationId,
    });