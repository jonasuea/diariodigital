import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, Bell, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
    id: string;
    remetente_nome: string;
    assunto: string;
    conteudo: string;
    data_envio: any;
    tipo: string;
    destinatario_grupo?: string | null;
    destinatario_id?: string | null;
    remetente_id: string;
    escola_id: string;
    excluido_destinatario?: boolean;
}

export function MessagePopup() {
    const { user } = useAuth();
    const { role, escolaAtivaId, isGestor, isPedagogo, isSecretario } = useUserRole();
    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [seenIds, setSeenIds] = useState<string[]>([]);
    const [justReadIds, setJustReadIds] = useState<string[]>([]);
    const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
    const [open, setOpen] = useState(false);

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

            const isForMe = (msg.tipo === 'direta' && (msg as any).destinatario_id === user.uid) ||
                (msg.tipo === 'grupo' && isForMyGroup && (msg as any).remetente_id !== user.uid && isRelevantSchool);

            const alreadySeen = seenIds.includes(msg.id) || justReadIds.includes(msg.id);
            const isDirectAndRead = msg.tipo === 'direta' && (msg as any).lido === true;

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
            setJustReadIds(prev => [...prev, msgId]);
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

    if (!currentMessage) return null;

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent
                className="max-w-md sm:rounded-2xl border-primary/20 shadow-2xl"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="flex flex-col items-center text-center pb-4 border-b">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Bell className="h-6 w-6 text-primary animate-bounce" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                        Nova Mensagem Recebida
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">
                        De: {currentMessage.remetente_nome}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    <h3 className="font-bold text-lg mb-2 text-foreground">{currentMessage.assunto}</h3>
                    <div className="bg-muted/30 p-4 rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto border">
                        {currentMessage.conteudo}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4 text-right">
                        Enviada em {currentMessage.data_envio?.toDate() ? format(currentMessage.data_envio.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                    </p>
                </div>

                <DialogFooter className="sm:justify-center pt-2">
                    <Button
                        onClick={handleRead}
                        className="w-full h-12 gap-2 font-bold text-base shadow-lg transition-all hover:scale-[1.02]"
                    >
                        <CheckCircle2 className="h-5 w-5" /> LI E ESTOU CIENTE
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
