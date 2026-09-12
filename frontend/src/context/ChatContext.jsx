import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
} from 'react';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    // Ref, чтобы useSocket видел актуальные значения
    // (он подписывается один раз и не перезапускает обработчики)
    const stateRef = useRef({ activeConversationId: null, isOpen: false });

    useEffect(() => {
        stateRef.current = { activeConversationId, isOpen };
    }, [activeConversationId, isOpen]);

    return (
        <ChatContext.Provider
            value={{
                activeConversationId,
                setActiveConversationId,
                isOpen,
                setIsOpen,
                stateRef,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};

export const useChatState = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) {
        throw new Error('useChatState must be used within ChatProvider');
    }
    return ctx;
};