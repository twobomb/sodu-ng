import { useState, useEffect } from 'react';
import {
    X,
    MessageCircle,
    Hash,
    MessageSquare,
    Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { usePermissions } from '../../hooks/usePermissions';
import { useChatState } from '../../context/ChatContext';
import { useChatUnreadCounts } from '../../hooks/useChat';
import {
    isFloatingButtonEnabled,
    subscribeToUiPrefs,
} from '../../lib/chatUiPrefs';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import ChatSettings from './ChatSettings.jsx';

const TABS = [
    { key: 'all', label: 'Все чаты', icon: MessageCircle },
    { key: 'channels', label: 'Каналы', icon: Hash },
    { key: 'chats', label: 'Чаты', icon: MessageSquare },
    { key: 'settings', label: 'Настройки', icon: SettingsIcon },
];

const Badge = ({ count, size = 'md' }) => {
    if (!count || count <= 0) return null;
    const sizeCls =
        size === 'sm'
            ? 'h-4 min-w-4 px-0.5 text-[9px] ring-2'
            : 'h-5 min-w-5 px-1 text-[10px] ring-2';
    return (
        <span
            className={`absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white font-bold flex items-center justify-center ring-white ${sizeCls}`}
        >
      {count > 99 ? '99+' : count}
    </span>
    );
};

const ChatWidget = () => {
    const { has } = usePermissions();
    const {
        activeConversationId,
        setActiveConversationId,
        isOpen,
        setIsOpen,
    } = useChatState();

    const [tab, setTab] = useState('all');
    const [showFloating, setShowFloating] = useState(isFloatingButtonEnabled());

    const unread = useChatUnreadCounts();

    // Подписка на изменение настроек UI
    useEffect(() => {
        const update = () => setShowFloating(isFloatingButtonEnabled());
        return subscribeToUiPrefs(update);
    }, []);

    useEffect(() => {
        const handler = () => setIsOpen((v) => !v);
        window.addEventListener('chat:toggle', handler);
        return () => window.removeEventListener('chat:toggle', handler);
    }, [setIsOpen]);

    if (!has('chat.use')) return null;

    const tabBadges = {
        all: unread.total,
        channels: unread.channels,
        chats: unread.chats,
        settings: 0,
    };

    return (
        <>
            {/* Плавающая кнопка — только если включена в настройках и панель закрыта */}
            {!isOpen && showFloating && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
                    title="Чат"
                >
                    <MessageCircle className="h-6 w-6" />
                    <Badge count={unread.total} />
                </button>
            )}

            <div
                className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 flex-shrink-0">
                    <h2 className="font-semibold text-slate-800">Чат</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsOpen(false)}
                        className="h-8 w-8 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex border-b border-slate-200 flex-shrink-0">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        const badge = tabBadges[t.key] || 0;

                        return (
                            <button
                                key={t.key}
                                onClick={() => {
                                    setTab(t.key);
                                    if (t.key !== 'settings') setActiveConversationId(null);
                                }}
                                className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                                    active
                                        ? 'text-orange-600 border-b-2 border-orange-500'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <div className="relative">
                                    <Icon className="h-4 w-4" />
                                    {badge > 0 && <Badge count={badge} size="sm" />}
                                </div>
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* min-h-0 вместо overflow-hidden — чтобы попапы не обрезались */}
                <div className="flex-1 min-h-0">
                    {tab === 'settings' ? (
                        <ChatSettings />
                    ) : activeConversationId ? (
                        <ChatWindow
                            key={activeConversationId}
                            conversationId={activeConversationId}
                            onBack={() => setActiveConversationId(null)}
                            isVisible={isOpen}
                        />
                    ) : (
                        <ChatList filter={tab} onSelect={setActiveConversationId} />
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatWidget;