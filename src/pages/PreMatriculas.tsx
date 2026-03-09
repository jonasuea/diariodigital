
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search,
    Check,
    X,
    Clock,
    UserPlus,
    ChevronLeft,
    ChevronRight,
    Filter,
    ListFilter,
    Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    limit,
    startAfter,
    Timestamp
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/logger';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PreMatricula {
    id: string;
    nome: string;
    cpf: string;
    sexo: string;
    endereco: string;
    responsavel_nome: string;
    status: 'pendente' | 'confirmada' | 'rejeitada' | 'expirada';
    data_criacao: Timestamp;
    data_expiracao: Timestamp;
}

export default function PreMatriculas() {
    const navigate = useNavigate();
    const { isAdmin, isGestor, isSecretario, escolaAtivaId } = useUserRole();
    const [reservas, setReservas] = useState<PreMatricula[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('pendente');
    const [activeTab, setActiveTab] = useState('vagas');
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const PAGE_SIZE = 15;

    useEffect(() => {
        fetchReservas();
    }, [search, statusFilter, activeTab, escolaAtivaId]);

    async function fetchReservas(next = false) {
        if (!escolaAtivaId && !isAdmin) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let collectionName = activeTab === 'vagas' ? 'pre_matriculas' : 'estudantes';
            let q = query(
                collection(db, collectionName),
                orderBy(activeTab === 'vagas' ? 'data_criacao' : 'data_cadastro', 'desc'),
                limit(PAGE_SIZE + 1)
            );

            // Filtro por escola (obrigatório se não for master admin visualizando tudo, 
            // mas por padrão filtramos pela escola ativa selecionada no cabeçalho)
            if (escolaAtivaId) {
                q = query(q, where('escola_id', '==', escolaAtivaId));
            }

            if (activeTab === 'vagas') {
                q = query(q, where('excluido', '==', false));
                if (statusFilter && statusFilter !== 'todos') {
                    q = query(q, where('status', '==', statusFilter));
                }
            } else {
                // Para estudantes cadastrados pelo portal, filtramos pelos que ainda não têm status definido e sem turma
                q = query(q, where('status', 'in', ['', 'pendente']), where('turma_id', '==', ''));
            }

            if (next && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const snap = await getDocs(q);
            let docs = snap.docs;

            const hasNext = docs.length > PAGE_SIZE;
            const displayDocs = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

            setHasMore(hasNext);
            if (displayDocs.length > 0) {
                setLastVisible(displayDocs[displayDocs.length - 1]);
            }

            const data = displayDocs.map(d => {
                const docData = d.data();
                return {
                    id: d.id,
                    ...docData,
                    // Normalização de campos entre as duas coleções
                    data_criacao: docData.data_criacao || docData.data_cadastro || Timestamp.now(),
                    status: docData.status || 'pendente',
                    escola_nome: docData.escola_nome || docData.escolaNome || "---"
                };
            }) as unknown as PreMatricula[];

            // Local search filtering if needed (Firestore search is limited)
            const filteredData = search
                ? data.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || r.cpf.includes(search))
                : data;

            setReservas(filteredData);
            if (!next) setPage(1);
        } catch (error) {
            toast.error('Erro ao carregar pré-matrículas');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleNextPage = () => {
        setPage(prev => prev + 1);
        fetchReservas(true);
    };

    const handlePrevPage = () => {
        setPage(1);
        fetchReservas();
    };

    async function handleUpdateStatus(id: string, nome: string, newStatus: 'confirmada' | 'rejeitada') {
        try {
            await updateDoc(doc(db, 'pre_matriculas', id), {
                status: newStatus,
                updated_at: new Date()
            });

            toast.success(`Reserva ${newStatus === 'confirmada' ? 'confirmada' : 'rejeitada'} com sucesso!`);
            await logActivity(`Reserva de ${nome} marcada como ${newStatus}`);
            fetchReservas();

            if (newStatus === 'confirmada') {
                toast.info('Agora você pode realizar o cadastro completo do estudante.', {
                    action: {
                        label: 'Cadastrar Agora',
                        onClick: () => navigate('/estudantes/novo')
                    }
                });
            }
        } catch (error) {
            toast.error('Erro ao atualizar status');
        }
    }

    async function handleApproveRegistration(id: string, nome: string) {
        try {
            await updateDoc(doc(db, 'estudantes', id), {
                status: 'Matriculado',
                excluido: false,
                data_matricula: new Date(),
                ultima_atualizacao: new Date()
            });
            toast.success('Matrícula ativada com sucesso!');
            await logActivity(`Matrícula do estudante ${nome} ativada via portal online`);
            fetchReservas();
        } catch (error) {
            toast.error('Erro ao ativar matrícula');
        }
    }

    const columns = [
        {
            key: 'data_criacao',
            header: 'Data Solicitação',
            render: (r: any) => {
                const date = r.data_criacao instanceof Timestamp ? r.data_criacao.toDate() : new Date();
                return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
            }
        },
        {
            key: 'nome',
            header: 'Estudante',
            render: (r: any) => (
                <div className="flex items-center gap-2">
                    {r.estudante_pcd && (
                        <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            DEF
                        </span>
                    )}
                    <span>{r.nome}</span>
                </div>
            )
        },
        {
            key: 'cpf',
            header: 'CPF',
            render: (r: any) => r.cpf || r.estudante_cpf || "---"
        },
        { key: 'responsavel_nome', header: 'Responsável' },
        {
            key: 'escola_nome',
            header: 'Escola Pretendida',
            render: (r: any) => r.escola_nome || "---"
        },
        {
            key: 'status',
            header: 'Status',
            render: (r: any) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.status === 'pendente' ? 'bg-warning/10 text-warning' :
                    r.status === 'confirmada' || r.status === 'Matriculado' ? 'bg-success/10 text-success' :
                        r.status === 'expirada' || r.status === 'Desistente' ? 'bg-destructive/10 text-destructive' :
                            r.status === 'Transferido' ? 'bg-blue-100 text-blue-600' :
                                'bg-muted text-muted-foreground'
                    }`}>
                    {r.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'data_expiracao',
            header: activeTab === 'vagas' ? 'Expira em' : 'Última Atualização',
            render: (r: any) => {
                const date = r.data_expiracao || r.ultima_atualizacao;
                if (!date) return "---";
                const d = date instanceof Timestamp ? date.toDate() : new Date();
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(d, 'dd/MM/yyyy')}
                    </div>
                )
            }
        },
        {
            key: 'actions',
            header: 'Ações',
            render: (r: any) => (
                <div className="flex gap-2">
                    {activeTab === 'vagas' ? (
                        <>
                            {r.status === 'pendente' && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="hover:bg-success/10 group"
                                        onClick={() => handleUpdateStatus(r.id, r.nome, 'confirmada')}
                                        title="Confirmar Presença/Vaga"
                                    >
                                        <Check className="h-4 w-4 text-success group-hover:scale-110 transition-transform" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="hover:bg-destructive/10 group"
                                        onClick={() => handleUpdateStatus(r.id, r.nome, 'rejeitada')}
                                        title="Rejeitar Solicitação"
                                    >
                                        <X className="h-4 w-4 text-destructive group-hover:scale-110 transition-transform" />
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/estudantes/novo', { state: { preMatriculaData: r } })}
                                title="Efetivar Matrícula"
                            >
                                <UserPlus className="h-4 w-4 text-blue-500" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApproveRegistration(r.id, r.nome)}
                                title="Aprovar e Ativar Matrícula"
                                className="hover:bg-success/10"
                            >
                                <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/estudantes/${r.id}`)}
                                title="Ver Perfil Completo"
                            >
                                <Eye className="h-4 w-4 text-primary" />
                            </Button>
                        </>
                    )}
                </div>
            )
        }
    ];

    if (!isAdmin && !isGestor && !isSecretario) {
        return (
            <AppLayout title="Acesso Negado">
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <h2 className="text-2xl font-bold">Você não tem permissão para acessar esta página.</h2>
                    <Button onClick={() => navigate('/painel')} className="mt-4">Voltar ao Painel</Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Pré-Matrículas Online">
            <div className="space-y-6 animate-fade-in">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md">
                        <TabsTrigger value="vagas" className="font-bold">RESERVAS DE VAGA</TabsTrigger>
                        <TabsTrigger value="cadastros" className="font-bold">CADASTROS ONLINE</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou CPF..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {activeTab === 'vagas' && (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="pendente">Pendentes</option>
                                <option value="confirmada">Confirmadas</option>
                                <option value="expirada">Expiradas</option>
                                <option value="rejeitada">Rejeitadas</option>
                                <option value="todos">Todas</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={reservas}
                        loading={loading}
                        emptyMessage="Nenhuma pré-matrícula encontrada"
                    />
                </div>

                <div className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">
                        Página {page}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrevPage}
                            disabled={page === 1 || loading}
                        >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Início
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={!hasMore || loading}
                        >
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
