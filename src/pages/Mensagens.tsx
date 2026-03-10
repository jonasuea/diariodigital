import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    MessageSquare,
    Send,
    Inbox,
    Users,
    User,
    Search,
    Plus,
    Clock,
    CheckCircle2,
    Trash2,
    AlertCircle,
    ChevronRight,
    Filter
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    getDocs,
    getDoc,
    limit,
    Timestamp
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
    id: string;
    remetente_id: string;
    remetente_nome: string;
    remetente_perfil: string;
    tipo: 'direta' | 'grupo';
    destinatario_id?: string;
    destinatario_nome?: string;
    destinatario_email?: string;
    destinatario_grupo?: string;
    escola_id: string;
    assunto: string;
    conteudo: string;
    data_envio: Timestamp;
    lido: boolean;
    data_leitura?: Timestamp;
    excluido_remetente?: boolean;
    excluido_destinatario?: boolean;
}

export default function Mensagens() {
    const { user } = useAuth();
    const { role, escolaAtivaId, isAdmin, isGestor, isProfessor, isSecretario, isPedagogo } = useUserRole();

    const [messages, setMessages] = useState<Message[]>([]);
    const [sentMessages, setSentMessages] = useState<Message[]>([]);
    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [seenIds, setSeenIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('received');

    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // New Message Form
    const [msgType, setMsgType] = useState<'direta' | 'grupo'>('direta');
    const [targetGroup, setTargetGroup] = useState('');
    const [targetUserId, setTargetUserId] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);

    // List of potential recipients for direct messages
    const [availableUsers, setAvailableUsers] = useState<{ id: string, nome: string, role: string, email: string }[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // View Message Details
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    useEffect(() => {
        if (!user || !escolaAtivaId) return;

        // 1. Listen for ALL messages
        const qMessages = query(
            collection(db, 'mensagens'),
            orderBy('data_envio', 'desc')
        );

        const unsubscribeMessages = onSnapshot(qMessages, (msgSnapshot) => {
            const msgs = msgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setAllMessages(msgs);
        });

        // 2. Listen for ALREADY SEEN messages
        const qSeen = collection(db, 'profiles', user.uid, 'mensagens_vistas');
        const unsubscribeSeen = onSnapshot(qSeen, (seenSnapshot) => {
            setSeenIds(seenSnapshot.docs.map(d => d.id));
        });

        return () => {
            unsubscribeMessages();
            unsubscribeSeen();
        };
    }, [user, escolaAtivaId]);

    // 3. Filter and process messages
    useEffect(() => {
        if (!user || !escolaAtivaId) return;

        const allWithStatus = allMessages.map(msg => ({
            ...msg,
            lido: seenIds.includes(msg.id)
        }));

        // Filter for received
        const received = allWithStatus.filter(msg => {
            const isForMyGroup = msg.destinatario_grupo === role ||
                (msg.destinatario_grupo === 'equipe_gestora' && (isGestor || isPedagogo || isSecretario));

            const isRelevantSchool = msg.escola_id === escolaAtivaId || msg.escola_id === 'rede_inteira' || msg.tipo === 'direta';

            if (isAdmin) {
                return (msg.tipo === 'direta' && msg.destinatario_id === user.uid) ||
                    (msg.tipo === 'grupo' && isForMyGroup && msg.remetente_id !== user.uid && isRelevantSchool);
            }
            return (msg.tipo === 'direta' && msg.destinatario_id === user.uid && !msg.excluido_destinatario) ||
                (msg.tipo === 'grupo' && isForMyGroup && msg.remetente_id !== user.uid && isRelevantSchool);
        });

        // Filter for sent
        const sent = allWithStatus.filter(msg => {
            if (isAdmin) return msg.remetente_id === user.uid;
            return msg.remetente_id === user.uid && !msg.excluido_remetente;
        });

        setMessages(received);
        setSentMessages(sent);
        setLoading(false);
    }, [allMessages, seenIds, user, escolaAtivaId, role, isGestor, isPedagogo, isSecretario, isAdmin]);

    // Load potential recipients based on role permissions
    useEffect(() => {
        if (!isComposeOpen || !escolaAtivaId) return;

        async function fetchRecipients() {
            setLoadingUsers(true);
            try {
                // Simple strategy: Fetch profiles. In production, this should be a more filtered list.
                const q = query(
                    collection(db, 'profiles'),
                    where('excluido', '==', false),
                    limit(100)
                );
                const snap = await getDocs(q);

                // Fetch current roles for status/role verification
                const rolesSnap = await getDocs(collection(db, 'user_roles'));
                const rolesMap = new Map();
                rolesSnap.docs.forEach(d => rolesMap.set(d.id, d.data().role));

                const users = snap.docs
                    .map(d => {
                        const profileData = d.data();
                        // Prefer role from user_roles, fallback to profile.role
                        const profileRole = rolesMap.get(d.id) || profileData.role || 'unknown';
                        return {
                            id: d.id,
                            nome: profileData.nome,
                            role: profileRole,
                            email: profileData.email || 'N/A'
                        };
                    })
                    .filter(u => u.id !== user?.uid); // Don't send to self

                setAvailableUsers(users);
            } catch (error) {
                console.error("Erro ao buscar destinatários:", error);
            } finally {
                setLoadingUsers(false);
            }
        }

        fetchRecipients();
    }, [isComposeOpen, escolaAtivaId, user]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !content || (msgType === 'direta' && !targetUserId) || (msgType === 'grupo' && !targetGroup)) {
            toast.error("Por favor, preencha todos os campos.");
            return;
        }

        setSending(true);
        try {
            const senderProfile = await getDoc(doc(db, 'profiles', user!.uid));
            const senderName = senderProfile.data()?.nome || "Usuário";

            let destName = "";
            if (msgType === 'direta') {
                const destUser = availableUsers.find(u => u.id === targetUserId);
                destName = destUser?.nome || (targetUserId === 'unknown' ? 'Usuário' : 'Carregando...');
            }

            const messageData = {
                remetente_id: user!.uid,
                remetente_nome: senderName,
                remetente_perfil: role,
                tipo: msgType,
                destinatario_id: msgType === 'direta' ? targetUserId : null,
                destinatario_nome: msgType === 'direta' ? destName : (msgType === 'grupo' ? `Grupo ${targetGroup}` : null),
                destinatario_email: msgType === 'direta' ? availableUsers.find(u => u.id === targetUserId)?.email : null,
                destinatario_grupo: msgType === 'grupo' ? targetGroup : null,
                escola_id: escolaAtivaId,
                assunto: subject,
                conteudo: content,
                data_envio: serverTimestamp(),
                lido: false,
                excluido_remetente: false,
                excluido_destinatario: false
            };

            await addDoc(collection(db, 'mensagens'), messageData);

            toast.success("Mensagem enviada com sucesso!");
            setIsComposeOpen(false);
            resetForm();
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            toast.error("Erro ao enviar mensagem.");
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setMsgType('direta');
        setTargetGroup('');
        setTargetUserId('');
        setSubject('');
        setContent('');
    };

    const markAsRead = async (msg: Message) => {
        if (msg.lido || msg.remetente_id === user?.uid || !user) return;
        try {
            const { setDoc, serverTimestamp } = await import('firebase/firestore');
            await setDoc(doc(db, 'profiles', user.uid, 'mensagens_vistas', msg.id), {
                visto_em: serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao marcar como lida:", e);
        }
    };

    const deleteMessage = async (msgId: string, side: 'remetente' | 'destinatario', permanent = false) => {
        try {
            if (permanent && isAdmin) {
                const { deleteDoc } = await import('firebase/firestore');
                await deleteDoc(doc(db, 'mensagens', msgId));
                toast.success("Mensagem excluída permanentemente.");
            } else {
                const field = side === 'remetente' ? 'excluido_remetente' : 'excluido_destinatario';
                await updateDoc(doc(db, 'mensagens', msgId), { [field]: true });
                toast.success("Mensagem ocultada.");
            }
            if (selectedMessage?.id === msgId) setIsViewOpen(false);
        } catch (e) {
            toast.error("Erro ao excluir mensagem.");
        }
    };

    const filteredReceived = messages.filter(m =>
        m.assunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.remetente_nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSent = sentMessages.filter(m =>
        m.assunto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <MessageSquare className="h-8 w-8 text-primary" />
                            Mensagens
                        </h1>
                        <p className="text-muted-foreground">Comunicação interna e avisos para responsáveis</p>
                    </div>
                    <Button onClick={() => setIsComposeOpen(true)} className="gap-2 h-12 px-6 font-semibold">
                        <Plus className="h-5 w-5" />
                        Nova Mensagem
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar Filters/Stats */}
                    <div className="md:col-span-1 space-y-4">
                        <Card>
                            <CardContent className="p-4 space-y-2">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div
                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${activeTab === 'received' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-muted-foreground'}`}
                                        onClick={() => setActiveTab('received')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Inbox className="h-4 w-4" />
                                            <span>Recebidas</span>
                                        </div>
                                        <Badge variant={activeTab === 'received' ? 'default' : 'secondary'}>{messages.filter(m => !m.lido).length}</Badge>
                                    </div>
                                    <div
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeTab === 'sent' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-muted-foreground'}`}
                                        onClick={() => setActiveTab('sent')}
                                    >
                                        <Send className="h-4 w-4" />
                                        <span>Enviadas</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/50 border-none shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Filter className="h-3 w-3" /> Filtros
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-white transition-colors">Avisos de Grupo</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-white transition-colors ml-2">Não Lidas</Badge>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="md:col-span-3">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsContent value="received" className="mt-0">
                                <div className="space-y-3">
                                    {loading ? (
                                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                                    ) : filteredReceived.length > 0 ? (
                                        filteredReceived.map(msg => (
                                            <Card
                                                key={msg.id}
                                                className={`cursor-pointer transition-all hover:border-primary/40 hover:shadow-md ${!msg.lido ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                                                onClick={() => {
                                                    setSelectedMessage(msg);
                                                    setIsViewOpen(true);
                                                    markAsRead(msg);
                                                }}
                                            >
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${msg.tipo === 'grupo' ? 'bg-amber-100' : 'bg-primary/10'}`}>
                                                        {msg.tipo === 'grupo' ? <Users className="h-5 w-5 text-amber-600" /> : <User className="h-5 w-5 text-primary" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-sm ${!msg.lido ? 'font-bold' : 'font-medium'}`}>
                                                                    {msg.remetente_nome}
                                                                </p>
                                                                {msg.tipo === 'grupo' && <Badge variant="secondary" className="text-[10px] uppercase">Grupo: {msg.destinatario_grupo}</Badge>}
                                                                {isAdmin && msg.excluido_destinatario && <Badge variant="destructive" className="text-[10px] uppercase">Ocultada pelo Destinatário</Badge>}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {msg.data_envio?.toDate() ? format(msg.data_envio.toDate(), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Recentemente'}
                                                            </span>
                                                        </div>
                                                        <h4 className={`text-sm truncate ${!msg.lido ? 'text-foreground' : 'text-muted-foreground'}`}>{msg.assunto}</h4>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
                                            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                            <p className="text-muted-foreground">Nenhuma mensagem recebida encontrada.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="sent" className="mt-0">
                                <div className="space-y-3">
                                    {filteredSent.length > 0 ? (
                                        filteredSent.map(msg => (
                                            <Card
                                                key={msg.id}
                                                className="cursor-pointer hover:border-primary/40 transition-all"
                                                onClick={() => {
                                                    setSelectedMessage(msg);
                                                    setIsViewOpen(true);
                                                }}
                                            >
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Send className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold">
                                                                    Para: {msg.tipo === 'grupo' ? `Grupo ${msg.destinatario_grupo}` : (msg.destinatario_nome || 'Usuário Selecionado')}
                                                                </p>
                                                                {isAdmin && msg.excluido_remetente && <Badge variant="destructive" className="text-[10px] uppercase">Ocultada pelo Remetente</Badge>}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                 {msg.lido ? (
                                                                    <div className="flex items-center gap-1 text-primary">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        <span>Lida</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                                        <Clock className="h-3 w-3" />
                                                                        <span>Pendente</span>
                                                                    </div>
                                                                )}
                                                                {msg.data_envio?.toDate() ? format(msg.data_envio.toDate(), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Pendente'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-sm font-medium text-muted-foreground truncate">{msg.assunto}</h4>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
                                            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                            <p className="text-muted-foreground">Você ainda não enviou mensagens.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Compose Modal */}
            <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Nova Mensagem</DialogTitle>
                        <DialogDescription>A comunicação interna fortalece nossa comunidade escolar.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSendMessage} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Envio</Label>
                                <Select value={msgType} onValueChange={(v: any) => setMsgType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="direta">Individual</SelectItem>
                                        {(isAdmin || isGestor || isSecretario || isPedagogo) && <SelectItem value="grupo">Grupo</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>

                            {msgType === 'grupo' ? (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label>Grupo Destinatário</Label>
                                    <Select value={targetGroup} onValueChange={setTargetGroup}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                                        <SelectContent>
                                            {(isAdmin || isGestor) && <SelectItem value="professor">Professores</SelectItem>}
                                            <SelectItem value="equipe_gestora">Equipe Gestora</SelectItem>
                                            <SelectItem value="responsavel">Responsáveis</SelectItem>
                                            <SelectItem value="estudante">Estudantes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label>Destinatário</Label>
                                    <Select value={targetUserId} onValueChange={setTargetUserId} disabled={loadingUsers}>
                                        <SelectTrigger><SelectValue placeholder={loadingUsers ? "Carregando..." : "Selecione o usuário"} /></SelectTrigger>
                                        <SelectContent>
                                            {availableUsers.map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.nome} ({u.role}) - {u.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Assunto</Label>
                            <Input
                                placeholder="Ex: Reunião de Pais, Avisos Disciplinares..."
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Conteúdo da Mensagem</Label>
                            <Textarea
                                placeholder="Digite sua mensagem detalhadamente..."
                                className="min-h-[150px] resize-none"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsComposeOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={sending} className="gap-2 px-8">
                                {sending ? "Enviando..." : <><Send className="h-4 w-4" /> Enviar Mensagem</>}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Message Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="max-w-2xl">
                    {selectedMessage && (
                        <>
                            <DialogHeader className="border-b pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant={selectedMessage.tipo === 'grupo' ? 'secondary' : 'outline'}>
                                        {selectedMessage.tipo === 'grupo' ? `Grupo: ${selectedMessage.destinatario_grupo}` : 'Mensagem Direta'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {selectedMessage.data_envio?.toDate() ? format(selectedMessage.data_envio.toDate(), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                                    </span>
                                </div>
                                <DialogTitle className="text-2xl">{selectedMessage.assunto}</DialogTitle>
                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-3 w-3 text-primary" />
                                    </div>
                                    <span>De: <strong>{selectedMessage.remetente_nome}</strong></span>
                                    <span className="mx-1">•</span>
                                    <span className="capitalize">{selectedMessage.remetente_perfil}</span>
                                </div>
                            </DialogHeader>

                            <div className="py-6 whitespace-pre-wrap text-foreground leading-relaxed">
                                {selectedMessage.conteudo}
                            </div>

                            <DialogFooter className="border-t pt-4 flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
                                        onClick={() => deleteMessage(selectedMessage.id, selectedMessage.remetente_id === user?.uid ? 'remetente' : 'destinatario')}
                                    >
                                        <Trash2 className="h-4 w-4" /> Excluir
                                    </Button>

                                    {isAdmin && (
                                        <Button
                                            variant="destructive"
                                            className="gap-2"
                                            onClick={() => {
                                                if (confirm("Deseja realmente excluir DEFINITIVAMENTE esta mensagem do banco de dados?")) {
                                                    deleteMessage(selectedMessage.id, 'remetente', true);
                                                }
                                            }}
                                        >
                                            <AlertCircle className="h-4 w-4" /> Excluir Definitivo (Admin)
                                        </Button>
                                    )}
                                </div>
                                <Button onClick={() => setIsViewOpen(false)}>Fechar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
