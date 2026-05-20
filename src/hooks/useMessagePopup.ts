import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export interface Message {
    id: string;
    remetente_nome: string;
    assunto: string;
    conteudo: string;
    data_envio: { toDate?: () => Date } | null;
    tipo: string;
    destinatario_grupo?: string | null;
    destinatario_id?: string | null;
    remetente_id: string;
    escola_id: string;
    excluido_destinatario?: boolean;
    lido?: boolean;
    data_leitura?: any;
}

export function useMessagePopup() {
    const { user } = useAuth();
    const { role, escolaAtivaId, isGestor, isPedagogo, isSecretario } = useUserRole();
    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [seenIds, setSeenIds] = useState<string[]>([]);
    const [justReadIds, setJustReadIds] = useState<string[]>([]);
    const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
    const [open, setOpen] = useState(false);

    // 0. Load acknowledged messages from localStorage onto justReadIds (persistence across remounts)
    useEffect(() => {
        const stored = localStorage.getItem('acknowledged_messages');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Filter out entries older than 24 hours
                const now = Date.now();
                const oneDay = 24 * 60 * 60 * 1000;
                const validIds = Object.entries(parsed)
                    .filter(([_, timestamp]) => now - (timestamp as number) < oneDay)
                    .map(([id, _]) => id);

                if (validIds.length > 0) {
                    setJustReadIds(validIds);
                }
            } catch (e) {
                console.error("Erro ao carregar mensagens lidas do localStorage:", e);
            }
        }
    }, []);

    // Helper to add to justReadIds and localStorage
    const markAsJustRead = useCallback((id: string) => {
        setJustReadIds(prev => {
            if (prev.includes(id)) return prev;
            const updated = [...prev, id];
            
            // Persist to localStorage
            const now = Date.now();
            const stored = localStorage.getItem('acknowledged_messages');
            let parsed = {};
            if (stored) {
                try { parsed = JSON.parse(stored); } catch(e) { console.error(e); }
            }
            (parsed as Record<string, number>)[id] = now;
            localStorage.setItem('acknowledged_messages', JSON.stringify(parsed));
            
            return updated;
        });
    }, []);

    useEffect(() => {
        if (!user || !escolaAtivaId) return;

        // 1. Listen for ALL relevant messages
        const qMessages = query(
            collection(db, 'mensagens'),
            orderBy('data_envio', 'desc')
        );

        const unsubscribeMessages = onSnapshot(qMessages, (msgSnapshot) => {
            const msgs = msgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setAllMessages(msgs);
        });

        // 2. Listen for ALREADY SEEN messages by this specific user
        const qSeen = collection(db, 'profiles', user.uid, 'mensagens_vistas');
        const unsubscribeSeen = onSnapshot(qSeen, (seenSnapshot) => {
            setSeenIds(seenSnapshot.docs.map(d => d.id));
        });

        return () => {
            unsubscribeMessages();
            unsubscribeSeen();
        };
    }, [user, escolaAtivaId]);

    // 3. Filter and process unread messages (derived state)
    const unreadMessages = useMemo(() => {
        if (!user || !escolaAtivaId) return [];

        return allMessages.filter(msg => {
            const isForMyGroup = msg.destinatario_grupo === role ||
                (msg.destinatario_grupo === 'equipe_gestora' && (isGestor || isPedagogo || isSecretario));

            const isRelevantSchool = msg.escola_id === escolaAtivaId || msg.escola_id === 'rede_inteira' || msg.tipo === 'direta';

            const isForMe = (msg.tipo === 'direta' && msg.destinatario_id === user.uid) ||
                (msg.tipo === 'grupo' && isForMyGroup && msg.remetente_id !== user.uid && isRelevantSchool);

            const alreadySeen = seenIds.includes(msg.id) || justReadIds.includes(msg.id);
            const isDirectAndRead = msg.tipo === 'direta' && msg.lido === true;

            return isForMe && !alreadySeen && !isDirectAndRead;
        });
    }, [allMessages, seenIds, justReadIds, user, escolaAtivaId, role, isGestor, isPedagogo, isSecretario]);

    // If already open, but current message was read elsewhere or removed, pick next
    useEffect(() => {
        if (unreadMessages.length > 0 && !currentMessage && !open) {
            setCurrentMessage(unreadMessages[0]);
            setOpen(true);
        } else if (unreadMessages.length === 0 && open) {
            setOpen(false);
            setCurrentMessage(null);
        }
    }, [unreadMessages, currentMessage, open]);

    const handleRead = async () => {
        if (!currentMessage || !user) return;

        try {
            const msgId = currentMessage.id;
            const isDirect = currentMessage.tipo === 'direta';

            // 1. Update local state immediately to avoid race condition/re-opening
            markAsJustRead(msgId);
            setOpen(false);
            setCurrentMessage(null);

            // 2. Mark as seen for THIS user in their personal subcollection
            await setDoc(doc(db, 'profiles', user.uid, 'mensagens_vistas', msgId), {
                visto_em: serverTimestamp()
            });

            // 3. TRIGGER: Sync back to the main message document if it's a direct message
            if (isDirect) {
                await updateDoc(doc(db, 'mensagens', msgId), {
                    lido: true,
                    data_leitura: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Erro ao marcar mensagem como lida:", error);
        }
    };

    return {
        currentMessage,
        open,
        handleRead
    };
}
