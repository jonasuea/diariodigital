import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    UserCog,
    Key,
    UserCheck,
    UserX,
    Trash2,
    Search,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Trash,
    Users,
    Eye,
    Phone,
    Mail,
    Fingerprint
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    setDoc,
    limit,
    startAfter,
    orderBy,
    QueryDocumentSnapshot,
    DocumentData,
    getDoc
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Responsavel {
    id: string;
    nome: string;
    email: string;
    cpf?: string;
    contato?: string;
    status: 'ativo' | 'inativo';
    excluido?: boolean;
}

interface EstudanteVinculado {
    id: string;
    nome: string;
    turma_nome?: string;
    escola_nome?: string;
}

const PAGE_SIZE = 20;

export default function Responsaveis() {
    const navigate = useNavigate();
    const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [responsavelToDelete, setResponsavelToDelete] = useState<Responsavel | null>(null);
    const [studentsDialogOpen, setStudentsDialogOpen] = useState(false);
    const [selectedResponsavel, setSelectedResponsavel] = useState<Responsavel | null>(null);
    const [linkedStudents, setLinkedStudents] = useState<EstudanteVinculado[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    const { role: currentUserRole, isMasterAdmin, isAdmin, isGestor } = useUserRole();

    useEffect(() => {
        fetchResponsaveis();
    }, [searchTerm, showDeleted]);

    async function fetchResponsaveis(next = false) {
        setLoading(true);
        try {
            let qBase = query(
                collection(db, 'profiles'),
                where('role', '==', 'responsavel'),
                where('excluido', '==', showDeleted),
                orderBy('nome'),
                limit(PAGE_SIZE + 1)
            );

            if (searchTerm) {
                qBase = query(
                    collection(db, 'profiles'),
                    where('role', '==', 'responsavel'),
                    where('excluido', '==', showDeleted),
                    where('nome', '>=', searchTerm),
                    where('nome', '<=', searchTerm + '\uf8ff'),
                    orderBy('nome'),
                    limit(PAGE_SIZE + 1)
                );
            }

            if (next && lastVisible) {
                qBase = query(qBase, startAfter(lastVisible), limit(PAGE_SIZE + 1));
            }

            const snapshot = await getDocs(qBase);
            const docs = snapshot.docs;

            const hasNext = docs.length > PAGE_SIZE;
            const displayDocs = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

            setHasMore(hasNext);
            if (displayDocs.length > 0) {
                setLastVisible(displayDocs[displayDocs.length - 1]);
            }

            const userIds = displayDocs.map(d => d.id);
            const userRolesMap = new Map<string, any>();

            if (userIds.length > 0) {
                const rolesPromises = [];
                for (let i = 0; i < userIds.length; i += 30) {
                    const chunk = userIds.slice(i, i + 30);
                    const rq = query(collection(db, 'user_roles'), where('__name__', 'in', chunk));
                    rolesPromises.push(getDocs(rq));
                }
                const rolesSnapshots = await Promise.all(rolesPromises);
                rolesSnapshots.forEach(snap => {
                    snap.docs.forEach(d => userRolesMap.set(d.id, d.data()));
                });
            }

            const data = displayDocs.map(doc => {
                const profile = doc.data();
                const userRole = userRolesMap.get(doc.id);
                return {
                    id: doc.id,
                    nome: profile.nome || 'Nome não encontrado',
                    email: profile.email || userRole?.email || 'E-mail não encontrado',
                    cpf: profile.cpf || '',
                    contato: profile.contato || '',
                    status: (userRole?.status || 'ativo') as 'ativo' | 'inativo',
                    excluido: profile.excluido || false,
                };
            });

            setResponsaveis(data);
            if (!next) setPage(1);
        } catch (error: any) {
            console.error('Erro ao buscar responsáveis:', error);
            toast.error('Erro ao carregar responsáveis');
        } finally {
            setLoading(false);
        }
    }

    const handleNextPage = () => {
        setPage(prev => prev + 1);
        fetchResponsaveis(true);
    };

    const handlePrevPage = () => {
        setPage(1);
        fetchResponsaveis();
    };

    async function handleResetPassword(email: string) {
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success(`E-mail de redefinição enviado para ${email}`);
        } catch (error) {
            toast.error('Erro ao enviar e-mail de redefinição');
        }
    }

    async function handleToggleStatus(id: string, currentStatus: string, nome: string) {
        const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
        try {
            await setDoc(doc(db, 'user_roles', id), { status: newStatus }, { merge: true });
            setResponsaveis(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
            await logActivity(`${newStatus === 'ativo' ? 'ativou' : 'desativou'} o responsável "${nome}".`);
            toast.success(`Responsável ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
        } catch (error) {
            toast.error('Erro ao alterar status');
        }
    }

    async function handleDeleteResponsavel() {
        if (!responsavelToDelete) return;
        try {
            if (isMasterAdmin && showDeleted) {
                await deleteDoc(doc(db, 'user_roles', responsavelToDelete.id));
                await deleteDoc(doc(db, 'profiles', responsavelToDelete.id));
                await logActivity(`excluiu permanentemente o responsável "${responsavelToDelete.nome}".`);
                toast.success('Responsável excluído permanentemente!');
            } else {
                const timestamp = new Date();
                await updateDoc(doc(db, 'profiles', responsavelToDelete.id), {
                    excluido: true,
                    excluido_em: timestamp,
                    excluido_por: isMasterAdmin ? 'Master Admin' : 'Admin'
                } as any);
                await updateDoc(doc(db, 'user_roles', responsavelToDelete.id), {
                    excluido: true,
                    excluido_em: timestamp
                } as any);
                await logActivity(`moveu o responsável "${responsavelToDelete.nome}" para a lixeira.`);
                toast.success('Responsável movido para a lixeira!');
            }
            setDeleteDialogOpen(false);
            setResponsavelToDelete(null);
            fetchResponsaveis();
        } catch (error) {
            toast.error('Erro ao excluir responsável');
        }
    }

    async function handleReactivateResponsavel(responsavel: Responsavel) {
        try {
            const timestamp = new Date();
            await updateDoc(doc(db, 'profiles', responsavel.id), { excluido: false, reativado_em: timestamp } as any);
            await updateDoc(doc(db, 'user_roles', responsavel.id), { excluido: false, reativado_em: timestamp } as any);
            toast.success('Responsável reativado com sucesso!');
            fetchResponsaveis();
        } catch (error) {
            toast.error('Erro ao reativar responsável');
        }
    }

    async function handleViewStudents(responsavel: Responsavel) {
        setSelectedResponsavel(responsavel);
        setLoadingStudents(true);
        setStudentsDialogOpen(true);
        try {
            // Buscar estudantes vinculados pelo usuario_id ou cpf do responsável
            const studentsRef = collection(db, 'estudantes');

            const q1 = query(studentsRef, where('usuario_id', '==', responsavel.id));
            const q2 = query(studentsRef, where('responsavel_cpf', '==', responsavel.cpf));

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            const studentsList: EstudanteVinculado[] = [];
            const addedIds = new Set<string>();

            [...snap1.docs, ...snap2.docs].forEach(d => {
                if (!addedIds.has(d.id)) {
                    const data = d.data();
                    studentsList.push({
                        id: d.id,
                        nome: data.nome,
                        turma_nome: data.turma_nome,
                        escola_nome: data.escola_nome
                    });
                    addedIds.add(d.id);
                }
            });

            setLinkedStudents(studentsList);
        } catch (error) {
            console.error('Erro ao buscar estudantes vinculados:', error);
            toast.error('Erro ao carregar estudantes vinculados');
        } finally {
            setLoadingStudents(false);
        }
    }

    const columns = [
        { key: 'nome', header: 'Nome' },
        { key: 'email', header: 'E-mail' },
        {
            key: 'contato',
            header: 'Contato',
            render: (item: Responsavel) => item.contato || '-'
        },
        {
            key: 'status',
            header: 'Status',
            render: (item: Responsavel) => (
                <Badge variant={item.status === 'ativo' ? 'default' : 'destructive'}>
                    {item.status}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Ações',
            render: (item: Responsavel) => (
                <div className="flex items-center gap-2">
                    {showDeleted ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => handleReactivateResponsavel(item)} title="Reativar">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            {isMasterAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => { setResponsavelToDelete(item); setDeleteDialogOpen(true); }}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={() => handleViewStudents(item)} title="Ver Estudantes">
                                <Users className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleResetPassword(item.email)} title="Resetar Senha">
                                <Key className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleStatus(item.id, item.status, item.nome)} title={item.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                                {item.status === 'ativo' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { setResponsavelToDelete(item); setDeleteDialogOpen(true); }} title="Mover para Lixeira">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Responsáveis</h1>
                        <p className="text-muted-foreground">Gerencie os perfis de pais e responsáveis (Matrícula Online)</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {isAdmin && (
                            <Button variant={showDeleted ? "destructive" : "outline"} onClick={() => { setShowDeleted(!showDeleted); setPage(1); }} className="gap-2">
                                <Trash2 className="h-4 w-4" />
                                {showDeleted ? "Ver Ativos" : "Ver Lixeira"}
                            </Button>
                        )}
                    </div>
                </div>

                <DataTable columns={columns} data={responsaveis} loading={loading} emptyMessage="Nenhum responsável encontrado" />

                <div className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">Página {page}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page === 1 || loading}>
                            <ChevronLeft className="h-4 w-4 mr-2" /> Início
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasMore || loading}>
                            Próximo <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{showDeleted ? 'Excluir Permanentemente' : 'Mover para Lixeira'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {showDeleted
                                ? `Deseja excluir permanentemente "${responsavelToDelete?.nome}"?`
                                : `Deseja mover "${responsavelToDelete?.nome}" para a lixeira?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteResponsavel} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={studentsDialogOpen} onOpenChange={setStudentsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Estudantes Vinculados — {selectedResponsavel?.nome}</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                                <Mail className="h-4 w-4 text-primary" />
                                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">E-mail</p><p className="text-sm">{selectedResponsavel?.email}</p></div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                                <Phone className="h-4 w-4 text-primary" />
                                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Contato</p><p className="text-sm">{selectedResponsavel?.contato || 'Não informado'}</p></div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                                <Fingerprint className="h-4 w-4 text-primary" />
                                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">CPF</p><p className="text-sm">{selectedResponsavel?.cpf || 'Não informado'}</p></div>
                            </div>
                        </div>

                        <h3 className="font-heading font-bold mb-3 border-b pb-2">Lista de Estudantes</h3>
                        {loadingStudents ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                        ) : linkedStudents.length > 0 ? (
                            <div className="space-y-3">
                                {linkedStudents.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                        <div>
                                            <p className="font-semibold text-sm">{student.nome}</p>
                                            <p className="text-xs text-muted-foreground">{student.turma_nome || 'Sem turma'} • {student.escola_nome || 'Sem escola'}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => { setStudentsDialogOpen(false); navigate(`/estudantes/${student.id}`); }}>
                                            <Eye className="h-4 w-4 mr-2" /> Ver Perfil
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Nenhum estudante vinculado formalmente encontrado.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
