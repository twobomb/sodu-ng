import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useChatState } from '../context/ChatContext';
import { useLocation } from 'react-router-dom';
import {
    playNotificationSound,
    isSoundEnabled,
} from '../lib/notificationSound';
import {
    playUnitStatusSound,
    isUnitSoundEnabled,
} from '../lib/unitNotificationSound';
import {
    playNewCallSound,
    isCallSoundEnabled,
} from '../lib/callNotificationSound';

// VITE_API_URL в проде = '/api', в dev = 'http://localhost:5000/api'.
// Убираем /api, и если остаётся пусто — значит API на том же origin.
// Возвращаем undefined, чтобы socket.io взял window.location (сам выберет wss:// на HTTPS).
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '') || undefined;

// Маппинг «домен изменений» (из payload события force_refresh) → предикат по
// queryKey. Бэкенд сообщает, какие домены реально изменились, а клиент
// инвалидирует ТОЛЬКО обветки — вместо глобальной перезагрузки всех кешей.
const DOMAIN_PREDICATES = {
    calls: (q) =>
        q.queryKey[0] === 'calls' ||
        q.queryKey[0] === 'call' ||
        q.queryKey[0] === 'call-departments',
    users: (q) => q.queryKey[0] === 'users',
    roles: (q) => q.queryKey[0] === 'roles' || q.queryKey[0] === 'permissionsCatalog',
    departments: (q) => q.queryKey[0] === 'departments',
    'department-types': (q) => q.queryKey[0] === 'department-types',
    'fire-categories': (q) =>
        ['fire-categories', 'calls', 'call'].includes(q.queryKey[0]),
    'fire-causes': (q) => ['fire-causes', 'calls', 'call'].includes(q.queryKey[0]),
    'fire-nonaccount': (q) =>
        ['fire-nonaccount', 'calls', 'call'].includes(q.queryKey[0]),
    garrisons: (q) => q.queryKey[0] === 'garrisons',
    'line-notes': (q) =>
        ['line-note', 'line-notes', 'line-notes-status'].includes(q.queryKey[0]),
    municipalities: (q) =>
        q.queryKey[0] === 'municipalities' ||
        (q.queryKey[0] === 'calls' && q.queryKey[1] === 'municipalities'),
    'unit-statuses': (q) => q.queryKey[0] === 'unit-statuses',
    'unit-types': (q) => ['unit-types', 'units', 'units-grid'].includes(q.queryKey[0]),
    units: (q) =>
        [
            'units',
            'units-grid',
            'unit',
            'unit-history',
            'units-history-global',
            'units-calls-available',
            'unit-metrics-history',
        ].includes(q.queryKey[0]),
    settings: (q) => q.queryKey[0] === 'settings' || q.queryKey[0] === 'publicSettings',
};


export const useSocket = () => {
    const { user } = useAuth();
    const { stateRef: chatStateRef } = useChatState();
    const queryClient = useQueryClient();
    const socketRef = useRef(null);

    // ----- Ref на текущий путь -----
    const location = useLocation();
    const pathnameRef = useRef(location.pathname);

    useEffect(() => {
        pathnameRef.current = location.pathname;
    }, [location.pathname]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !user) return;

        const socket = io(SOCKET_URL, { auth: { token } });
        socketRef.current = socket;

        // Диагностика циклических сокет-событий (по умолчанию выключено).
        // В консоли браузера выполнить:  window.__traceSocket = true
        // затем отправить 1 сообщение в чат и подождать ~10-15 секунд.
        // Каждые 3 сек печатается сводка счётчиков по каждому событию — по ней
        // сразу видно, какое событие приходит многократно (то и есть источник
        // цикла инвалидаций) и провоцирует «шторм» запросов.
        socket.onAny((ev) => {
            if (typeof window !== 'undefined' && window.__traceSocket) {
                if (!window.__traceCounts) window.__traceCounts = {};
                window.__traceCounts[ev] = (window.__traceCounts[ev] || 0) + 1;
                if (!window.__traceTimer) {
                    window.__traceTimer = setInterval(() => {
                        const c = window.__traceCounts || {};
                        console.log(
                            '▸ socket summary @',
                            new Date().toLocaleTimeString(),
                            JSON.stringify(c)
                        );
                    }, 3000);
                }
            }
        });

        socket.on('connect', () => console.log('Socket подключён'));
        socket.on('connect_error', (err) =>
            console.warn('Socket ошибка:', err.message)
        );
        // Диагностика флапа socket-соединения: если на отправку сообщения сокет
        // переподключается (disconnect → reconnect), а у query-кешей включён
        // refetchOnReconnect, это даёт перезапрос ВСЕХ активных кешей разом.
        socket.on('disconnect', (reason) =>
            console.warn('SOCKET DISCONNECT:', reason)
        );
        socket.on('reconnect', (attempt) =>
            console.log('SOCKET RECONNECT attempt', attempt)
        );

        // ============================================================
        // Дебаунс инвалидаций HTTP-кеша (главная оптимизация).
        // Одна «интент» пользователя (например, отправка сообщения) порождает
        // сразу несколько socket-событий: chat:message + chat:conversation_updated
        // + chat:conversation_list_dirty [+ chat:read у получателя]. Раньше КАЖДОЕ
        // из них немедленно инвалидировало одни и те же query-кеши, из-за чего на
        // одно сообщение уходило по 20-40 одинаковых HTTP-запросов на клиент
        // (GET /api/chat/conversations?filter=all, .../messages?limit=30&before=...).
        // Теперь «грязные» ключи копятся и сбрасываются ОДНИМ flush-ом через
        // короткий таймаут — лавина схлопывается в 1-2 запроса.
        // ============================================================
        let dirtyKeys = new Set();
        let dirtyPredicates = [];
        let flushTimer = null;
        // Throttle: разрыв любых циклов «инвалидация → рефетч → инвалидация».
        // Если какой-либо кеш перезапрашивается слишком часто (пачка событий в
        // цикле), пропускаем повторные инвалидации того же ключа чаще, чем раз в
        // REFETCH_THROTTLE_MS. В обычном трафике (редкие инвалидации) throttle
        // не срабатывает и не влияет на отзывчивость.
        const REFETCH_THROTTLE_MS = 2000;
        const lastInvalidatedAt = new Map();

        const throttled = (keyStr) => {
            const now = Date.now();
            const last = lastInvalidatedAt.get(keyStr);
            if (last && now - last < REFETCH_THROTTLE_MS) return false;
            lastInvalidatedAt.set(keyStr, now);
            return true;
        };

        const scheduleFlush = () => {
            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = setTimeout(runFlush, 250);
        };

        const runFlush = () => {
            flushTimer = null;
            if (dirtyKeys.size === 0 && dirtyPredicates.length === 0) return;
            const keys = Array.from(dirtyKeys);
            const preds = dirtyPredicates;
            dirtyKeys = new Set();
            dirtyPredicates = [];
            const seen = new Set();
            const trace = typeof window !== 'undefined' && window.__traceSocket;
            if (trace) {
                console.log('▸ flush preds:', preds.length);
            }
            preds.forEach((p) => queryClient.invalidateQueries({ predicate: p }));
            keys.forEach((k) => {
                const keyStr = JSON.stringify(k);
                if (seen.has(keyStr)) return;
                seen.add(keyStr);
                if (throttled(keyStr)) {
                    queryClient.invalidateQueries(k);
                    if (trace) console.log('▸   invalidate', keyStr);
                } else if (trace) {
                    console.log('▸   THROTTLED', keyStr);
                }
            });
        };

        // Поставить query-кеш(и) в очередь на инвалидацию (схлопывание).
        const scheduleInvalidate = (key) => {
            if (!key) return;
            dirtyKeys.add(key);
            scheduleFlush();
        };

        // ============================================================
        // ОБЩИЕ
        // ============================================================

        // force_refresh — инвалидируем только HTTP-кеши.
        // Бэкенд передаёт в payload списка доменов, которые реально изменились:
        // клиент перезапрашивает только эти ветки кеша, а не ВСЁ (раньше любая
        // правка в админке дёргала у всех клиентов перезагрузку всех данных).
        // Кеши, которые наполняются ТОЛЬКО через сокет (onlineUsers, broadcast),
        // и одноразовые blob-ссылки (attachment-blob) — не трогаем.
        // Дебаунс: пачка force_refresh (серия правок) схлопывается в ОДИН прогон.
        socket.on('force_refresh', (payload) => {
            const domains = Array.isArray(payload?.domains)
                ? payload.domains
                : null;

            if (domains && domains.length) {
                const preds = domains
                    .map((d) => DOMAIN_PREDICATES[d])
                    .filter(Boolean);
                if (preds.length) {
                    dirtyPredicates.push((q) => preds.some((p) => p(q)));
                    scheduleFlush();
                    return;
                }
            }

            // Домен не указан или не распознан — грубая очистка (fallback).
            dirtyPredicates.push((query) => {
                const key = query.queryKey[0];
                return (
                    key !== 'attachment-blob' &&
                    key !== 'onlineUsers' &&
                    key !== 'broadcast'
                );
            });
            scheduleFlush();
        });

        socket.on('online_users', (users) =>
            queryClient.setQueryData(['onlineUsers'], users)
        );

        socket.on('admin:broadcast', (payload) => {
            queryClient.setQueryData(['broadcast', 'live'], payload);
        });

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
        // ТЕХНИКА: смена статуса — real-time + звук
        // ============================================================
        socket.on('unit:status_changed', (payload) => {
            const path = pathnameRef.current;
            const onUnitsPage =
                path === '/units' || path.startsWith('/units-grid');

            if (onUnitsPage && isUnitSoundEnabled()) {
                playUnitStatusSound();
            }

            queryClient.invalidateQueries(['units-grid']);
            queryClient.invalidateQueries(['units']);
            queryClient.invalidateQueries(['units-history-global']);
            if (payload?.unit_id) {
                queryClient.invalidateQueries(['unit-history', payload.unit_id]);
                queryClient.invalidateQueries(['unit', payload.unit_id]);
            }
        });

        // ============================================================
        // ВЫЗОВЫ: создан новый — real-time + звук
        // Бэкенд шлёт событие только тем, у кого есть доступ к вызову
        // (can_view_all / developer или пользователи доступных подразделений).
        // Звук играем, только если пользователь на странице «Вызовы»
        // или «Мониторинг вызовов» и звук включён.
        // ============================================================
        socket.on('call:created', (payload) => {
            const path = pathnameRef.current;
            const onCallsPage =
                path === '/calls' || path === '/calls-monitor';

            if (onCallsPage && isCallSoundEnabled()) {
                playNewCallSound();
            }

            queryClient.invalidateQueries(['calls']);
            queryClient.invalidateQueries(['calls', 'monitor']);

            if (payload?.id) {
                queryClient.invalidateQueries(['call', payload.id]);
            }
        });

        // ============================================================
        // ЧАТ: ПРОФИЛЬ
        // ============================================================
        socket.on('chat:profile_updated', () => {
            queryClient.invalidateQueries(['chat', 'profile']);
            queryClient.invalidateQueries(['chat', 'conversations']);
            queryClient.invalidateQueries(['chat', 'messages']);
        });

        // ============================================================
        // ЧАТ: СООБЩЕНИЯ
        // ============================================================
        // Обновить списки чатов (['chat', 'conversations', <filter>]) на месте:
        // новый last_message, счётчик непрочитанного (+1, если не своё сообщение),
        // порядок (вверх). БЕЗ refetch — это то, что позволяет обновлять «значок
        // непрочитанного» у ВСЕХ онлайн-участников (в т.ч. тех, кто не открыл чат)
        // без шторма GET на каждое сообщение при росте числа пользователей.
        const updateConversationLists = (message) => {
            queryClient.getQueryCache()
                .findAll({ queryKey: ['chat', 'conversations'] })
                .forEach((q) => {
                    const qk = q.queryKey;
                    queryClient.setQueryData(qk, (old) => {
                        if (!Array.isArray(old)) return old;
                        const idx = old.findIndex((c) => c.id === message.conversation_id);
                        if (idx === -1) return old;
                        const prev = old[idx];
                        const isOwn = message.user_id === user?.id;
                        const isSystem = message.content_type === 'system';
                        const next = {
                            ...prev,
                            last_message: message,
                            last_message_at: message.created_at,
                            updated_at: message.created_at,
                            unread_count: (prev.unread_count || 0) + ((isOwn || isSystem) ? 0 : 1),
                        };
                        const arr = [...old];
                        arr.splice(idx, 1);
                        arr.unshift(next);
                        return arr;
                    });
                });
        };

        socket.on('chat:message', (message) => {
            queryClient.setQueryData(
                ['chat', 'messages', message.conversation_id],
                (old) => {
                    if (!old || !Array.isArray(old.messages)) return old;
                    if (old.messages.some((m) => m.id === message.id)) return old;
                    return { ...old, messages: [...old.messages, message] };
                }
            );

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

            // Обновляем только список чатов (непрочитанные/порядок). Сообщение уже
            // добавлено в кеш через setQueryData выше; контент/детали чата от
            // получения сообщения не меняются — conversation НЕ инвалидируем
            // (это убирало лишний refetch и веер запросов на получателе).
            updateConversationLists(message);
        });

        socket.on('chat:message_edited', (message) => {
            queryClient.setQueryData(
                ['chat', 'messages', message.conversation_id],
                (old) => {
                    if (!old || !Array.isArray(old.messages)) return old;
                    return {
                        ...old,
                        messages: old.messages.map((m) =>
                            m.id === message.id ? message : m
                        ),
                    };
                }
            );
        });

        socket.on('chat:message_deleted', ({ id, conversation_id }) => {
            queryClient.setQueryData(
                ['chat', 'messages', conversation_id],
                (old) => {
                    if (!old || !Array.isArray(old.messages)) return old;
                    return {
                        ...old,
                        messages: old.messages.map((m) =>
                            m.id === id
                                ? {
                                    ...m,
                                    deleted_at: new Date().toISOString(),
                                    content: null,
                                }
                                : m
                        ),
                    };
                }
            );
            scheduleInvalidate(['chat', 'conversations']);
        });

        // ============================================================
        // ЧАТ: РАЗГОВОРЫ
        // ============================================================
        socket.on('chat:conversation_updated', () => {
            scheduleInvalidate(['chat', 'conversations']);
            scheduleInvalidate(['chat', 'conversation']);
        });

        socket.on('chat:conversation_created', (conversation) => {
            scheduleInvalidate(['chat', 'conversations']);
            if (conversation?.id) {
                socket.emit('chat:join', { conversationId: conversation.id });
            }
        });

        socket.on('chat:conversation_removed', () => {
            scheduleInvalidate(['chat', 'conversations']);
        });

        socket.on('chat:conversation_deleted', () => {
            scheduleInvalidate(['chat', 'conversations']);
        });

        socket.on('chat:conversation_list_dirty', () => {
            scheduleInvalidate(['chat', 'conversations']);
        });

        socket.on('chat:read', (payload) => {
            scheduleInvalidate(['chat', 'conversations']);
            if (payload?.conversation_id) {
                // «Прочитано» не меняет содержимое истории — обновляем только
                // первую страницу (без ?before=...), чтобы не гнать старые
                // страницы бесконечного запроса заново. Деталь разговора
                // (conversation) от прочтения не меняется — её не инвалидируем.
                queryClient.setQueryData(
                    ['chat', 'messages', payload.conversation_id],
                    (old) => {
                        if (!old || !Array.isArray(old.messages)) return old;
                        return {
                            ...old,
                            messages: old.messages.map((m) =>
                                payload.last_read_message_id &&
                                m.id === payload.last_read_message_id &&
                                !(m.read_by || []).includes(payload.user_id)
                                    ? {
                                        ...m,
                                        read_by: [...(m.read_by || []), payload.user_id],
                                        read_count: (m.read_count || 0) + 1,
                                    }
                                    : m
                            ),
                        };
                    }
                );
            }
        });

        socket.on('chat:member_added', ({ conversation_id }) => {
            queryClient.invalidateQueries(['chat', 'members', conversation_id]);
            queryClient.invalidateQueries(['chat', 'conversation', conversation_id]);
        });

        // ============================================================
        // ОЧИСТКА
        // ============================================================
        return () => {
            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = null;
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user, queryClient, chatStateRef]);

    return socketRef.current;
};