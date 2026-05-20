import { createContext, useContext, ReactNode } from 'react';
import { useMessagePopup, Message } from '@/hooks/useMessagePopup';

interface MessageContextType {
    currentMessage: Message | null;
    open: boolean;
    handleRead: () => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

/**
 * MessageProvider — instancia o hook useMessagePopup UMA única vez na raiz da app,
 * garantindo que só existam dois listeners onSnapshot ativos (mensagens + vistas),
 * independente de quantos componentes consumam o contexto.
 */
export function MessageProvider({ children }: { children: ReactNode }) {
    const popup = useMessagePopup();

    return (
        <MessageContext.Provider value={popup}>
            {children}
        </MessageContext.Provider>
    );
}

export function useMessage(): MessageContextType {
    const context = useContext(MessageContext);
    if (context === undefined) {
        throw new Error('useMessage must be used within a MessageProvider');
    }
    return context;
}
