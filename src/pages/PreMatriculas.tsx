
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
    Filter
} from 'lucide-react';
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
    const { isAdmin, isGestor, isSecretario } = useUserRole();
    const [reservas, setReservas] = useState<PreMatricula[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('pendente');
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const PAGE_SIZE = 15;

    useEffect(() => {
        fetchReservas();
    }, [search, statusFilter]);

    async function fetchReservas(next = false) {
        setLoading(true);
        try {
            let q = query(
                collection(db, 'pre_matriculas'),
                where('excluido', '==', false),
                orderBy('data_criacao', 'desc'),
                limit(PAGE_SIZE + 1)
            );

            if (statusFilter && statusFilter !== 'todos') {
                q = query(q, where('status', '==', statusFilter));
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

            const data = displayDocs.map(d => ({
                id: d.id,
                ...d.data()
            })) as PreMatricula[];

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

    async function handleUpdateStatus(id: string, newStatus: 'confirmada' | 'rejeitada') {
        try {
            await updateDoc(doc(db, 'pre_matriculas', id), {
                status: newStatus,
                updated_at: new Date()
            });

            toast.success(`Reserva ${newStatus === 'confirmada' ? 'confirmada' : 'rejeitada'} com sucesso!`);
            await logActivity(`Reserva ${id} marcada como ${newStatus}`);
            fetchReservas();

            if (newStatus === 'confirmada') {
                // Opcional: Sugerir redirecionamento para cadastro completo
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

    const columns = [
        {
            key: 'data_criacao',
            header: 'Data Solicitação',
            render: (r: PreMatricula) => format(r.data_criacao.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        },
        { key: 'nome', header: 'Estudante' },
        { key: 'cpf', header: 'CPF' },
        { key: 'responsavel_nome', header: 'Responsável' },
        {
            key: 'status',
            header: 'Status',
            render: (r: PreMatricula) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.status === 'pendente' ? 'bg-warning/10 text-warning' :
                        r.status === 'confirmada' ? 'bg-success/10 text-success' :
                            r.status === 'expirada' ? 'bg-destructive/10 text-destructive' :
                                'bg-muted text-muted-foreground'
                    }`}>
                    {r.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'data_expiracao',
            header: 'Expira em',
            render: (r: PreMatricula) => (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(r.data_expiracao.toDate(), 'dd/MM/yyyy')}
                </div>
            )
        },
        {
            key: 'actions',
            header: 'Ações',
            render: (r: PreMatricula) => (
                <div className="flex gap-2">
                    {r.status === 'pendente' && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-success/10 group"
                                onClick={() => handleUpdateStatus(r.id, 'confirmada')}
                                title="Confirmar Presença/Vaga"
                            >
                                <Check className="h-4 w-4 text-success group-hover:scale-110 transition-transform" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-destructive/10 group"
                                onClick={() => handleUpdateStatus(r.id, 'rejeitada')}
                                title="Rejeitar Solicitação"
                            >
                                <X className="h-4 w-4 text-destructive group-hover:scale-110 transition-transform" />
                            </Button>
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            // Navegar para novo estudante passando os dados via state (se suportado pelo NovoEstudante)
                            navigate('/estudantes/novo', { state: { preMatriculaData: r } });
                        }}
                        title="Efetivar Matrícula"
                    >
                        <UserPlus className="h-4 w-4 text-blue-500" />
                    </Button>
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
