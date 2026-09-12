import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useChatState } from '../context/ChatContext';
import {
    playNotificationSound,
    isSoundEnabled,
} from '../lib/notificationSound';
import {
    playUnitStatusSound,
    isUnitSoundEnabled,
} from '../lib/unitNotificationSound';

const SOCKET_URL =
    import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useSocket = () => {
    const { user } = useAuth();
    const { stateRef: chatStateRef } = useChatState();
    const queryClient = useQueryClient();
    const socketRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !user) return;

        const socket = io(SOCKET_URL, { auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => console.log('Socket подключён'));
        socket.on('connect_error', (err) =>
            console.warn('Socket ошибка:', err.message)
        );

        // ----- Общие -----
        socket.on('force_refresh', () => {
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0] !== 'attachment-blob',
            });
        });
        socket.on('online_users', (users) =>
            queryClient.setQueryData(['onlineUsers'], users)
        );
        socket.on('force_logout', (payload) => {
            const reason = payload?.reason || 'blocked';
            sessionStorage.setItem('logout_reason', reason);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
        socket.on('session_replaced', () => {
            sessionStorage.setItem('logout_reason', 'session_replaced');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
        socket.on('maintenance_mode_on', () =>
            queryClient.invalidateQueries(['publicSettings'])
        );
        socket.on('maintenance_mode_off', () =>
            queryClient.invalidateQueries(['publicSettings'])
        );

// ============================================================
// Техника: смена статуса — реальное время + звук
// ============================================================
        socket.on('unit:status_changed', (payload) => {
            // Звук — если включён
            if (isUnitSoundEnabled()) {
                playUnitStatusSound();
            }

            // Инвалидация кешей
            queryClient.invalidateQueries(['units-grid']);
            queryClient.invalidateQueries(['units']);
            queryClient.invalidateQueries(['units-history-global']);
            if (payload?.unit_id) {
                queryClient.invalidateQueries(['unit-history', payload.unit_id]);
            }
        });
        // ----- Чат: профиль -----
        socket.on('chat:profile_updated', () => {
            queryClient.invalidateQueries(['chat', 'profile']);
            queryClient.invalidateQueries(['chat', 'conversations']);
            queryClient.invalidateQueries(['chat', 'messages']);
        });

        // ----- Чат: сообщения -----
        socket.on('chat:message', (message) => {
            queryClient.setQueryData(
                ['chat', 'messages', message.conversation_id],
                (old) => {
                    if (!old) return old;
                    const exists = old.pages.some((page) =>
                        page.messages.some((m) => m.id === message.id)
                    );
                    if (exists) return old;

                    const newPages = [...old.pages];
                    const lastIdx = newPages.length - 1;
                    newPages[lastIdx] = {
                        ...newPages[lastIdx],
                        messages: [...newPages[lastIdx].messages, message],
                    };
                    return { ...old, pages: newPages };
                }
            );

            // Звук: только если сообщение не наше, не системное, звук включён
            // и НЕ идёт в активный открытый чат
            const { activeConversationId, isOpen } = chatStateRef.current;
            const isActiveChatVisible =
                activeConversationId === message.conversation_id && isOpen;

            if (
                !isActiveChatVisible &&
                message.user_id !== user?.id &&
                message.content_type !== 'system' &&
                isSoundEnabled()
            ) {
                playNotificationSound();
            }

            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        socket.on('chat:message_edited', (message) => {
            queryClient.setQueryData(
                ['chat', 'messages', message.conversation_id],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            messages: page.messages.map((m) =>
                                m.id === message.id ? message : m
                            ),
                        })),
                    };
                }
            );
        });

        socket.on('chat:message_deleted', ({ id, conversation_id }) => {
            queryClient.setQueryData(
                ['chat', 'messages', conversation_id],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            messages: page.messages.map((m) =>
                                m.id === id
                                    ? {
                                        ...m,
                                        deleted_at: new Date().toISOString(),
                                        content: null,
                                    }
                                    : m
                            ),
                        })),
                    };
                }
            );
            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        // ----- Чат: разговоры -----
        socket.on('chat:conversation_updated', () => {
            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        socket.on('chat:conversation_created', (conversation) => {
            queryClient.invalidateQueries(['chat', 'conversations']);
            if (conversation?.id) {
                socket.emit('chat:join', { conversationId: conversation.id });
            }
        });

        socket.on('chat:conversation_removed', () => {
            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        socket.on('chat:conversation_deleted', () => {
            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        socket.on('chat:conversation_list_dirty', () => {
            queryClient.invalidateQueries(['chat', 'conversations']);
        });

        socket.on('chat:read', (payload) => {
            queryClient.invalidateQueries(['chat', 'conversations']);
            if (payload?.conversation_id) {
                queryClient.invalidateQueries([
                    'chat',
                    'members',
                    payload.conversation_id,
                ]);
                queryClient.invalidateQueries([
                    'chat',
                    'messages',
                    payload.conversation_id,
                ]);
            }
        });

        socket.on('chat:member_added', ({ conversation_id }) => {
            queryClient.invalidateQueries(['chat', 'members', conversation_id]);
            queryClient.invalidateQueries(['chat', 'conversation', conversation_id]);
        });

        // ----- Очистка -----
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user, queryClient, chatStateRef]);

    return socketRef.current;
};