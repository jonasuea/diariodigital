import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Eye, Building2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/logger';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Escola {
    id: string;
    inep: string;
    nome: string;
    decreto_criacao: string;
    email: string;
    contato: string;
    zona: string;
    endereco: string;
    horario_funcionamento: string;
    salas_aula: string;
    laboratorios: string;
    banheiros: string;
    cantina: string;
    biblioteca: string;
    quadras: string;
}

export default function Escolas() {
    const navigate = useNavigate();
    const { isAdmin } = useUserRole();
    const [escolas, setEscolas] = useState<Escola[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [escolaToDelete, setEscolaToDelete] = useState<Escola | null>(null);

    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [escolaToView, setEscolaToView] = useState<Escola | null>(null);

    useEffect(() => {
        fetchEscolas();
    }, [search]); // Simplified local filtering for now, but preserving pattern

    async function fetchEscolas() {
        setLoading(true);
        try {
            const escolasQuery = query(collection(db, 'escolas'));
            const querySnapshot = await getDocs(escolasQuery);

            let fetchedEscolas = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    inep: doc.id,
                    nome: data.nome || '',
                    decreto_criacao: data.decreto_criacao || '',
                    email: data.email || '',
                    contato: data.contato || '',
                    zona: data.zona || '',
                    endereco: data.endereco || '',
                    horario_funcionamento: data.horario_funcionamento || '',
                    salas_aula: data.salas_aula || '',
                    laboratorios: data.laboratorios || '',
                    banheiros: data.banheiros || '',
                    cantina: data.cantina || '',
                    biblioteca: data.biblioteca || '',
                    quadras: data.quadras || ''
                } as Escola;
            });

            if (search) {
                const searchLower = search.toLowerCase();
                fetchedEscolas = fetchedEscolas.filter(escola =>
                    escola.nome.toLowerCase().includes(searchLower) ||
                    escola.inep.includes(searchLower)
                );
            }

            setEscolas(fetchedEscolas);
        } catch (error) {
            console.error('Sem permissão para buscar escolas:', error);
            toast.error('Sem permissão para carregar lista de escolas');
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async () => {
        if (!escolaToDelete) return;

        try {
            await deleteDoc(doc(db, 'escolas', escolaToDelete.inep));
            await logActivity(`Exclusão de Escola: Escola ${escolaToDelete.nome} excluída`);
            toast.success('Escola excluída com sucesso');
            setDeleteDialogOpen(false);
            setEscolaToDelete(null);
            fetchEscolas();
        } catch (error) {
            console.error('Sem permissão para excluir escola:', error);
            toast.error('Sem permissão para excluir escola');
        }
    };

    const openViewDialog = (escola: Escola) => {
        setEscolaToView(escola);
        setViewDialogOpen(true);
    };

    const columns = [
        {
            key: 'inep',
            header: 'INEP',
        },
        {
            key: 'nome',
            header: 'Nome da Escola',
        },
        {
            key: 'email',
            header: 'E-mail',
        },
        {
            key: 'contato',
            header: 'Contato',
        },
        {
            key: 'zona',
            header: 'Zona',
        },
        {
            key: 'actions',
            header: 'Ações',
            render: (escola: Escola) => {
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDialog(escola)}
                            title="Visualizar Detalhes"
                        >
                            <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                        {isAdmin && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(`/escolas/${escola.inep}/editar`)}
                                    title="Editar"
                                >
                                    <Pencil className="h-4 w-4 text-orange-500" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setEscolaToDelete(escola);
                                        setDeleteDialogOpen(true);
                                    }}
                                    title="Excluir"
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ];

    if (!isAdmin) {
        return (
            <AppLayout title="Acesso Negado">
                <div className="flex items-center justify-center p-8">
                    <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout title="Gestão de Escolas">
            <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Escolas</h2>
                        <p className="text-muted-foreground">Gerencie o cadastro de escolas do sistema.</p>
                    </div>
                    <Button onClick={() => navigate('/escolas/nova')} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Escola
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar escolas..."
                            className="pl-10 h-11 md:h-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mobile-safe-area">
                    <DataTable
                        columns={columns}
                        data={escolas}
                        loading={loading}
                        emptyMessage="Nenhuma escola encontrada"
                        mobileTitleKey="nome"
                        mobileSubtitleKey="inep"
                    />
                </div>

                {/* FAB for Nova Escola on Mobile */}
                <div className="md:hidden fixed bottom-6 right-6 z-50">
                    <Button
                        onClick={() => navigate('/escolas/nova')}
                        className="h-14 w-14 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center p-0"
                    >
                        <Plus className="h-7 w-7" />
                    </Button>
                </div>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir escola?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir a escola {escolaToDelete?.nome}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                Confirmar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Dossiê da Escola
                            </DialogTitle>
                        </DialogHeader>
                        {escolaToView && (
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">INEP</Label>
                                        <p className="font-semibold text-sm">{escolaToView.inep}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">Nome da Escola</Label>
                                        <p className="font-semibold text-sm">{escolaToView.nome}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">Decreto de Criação</Label>
                                        <p className="font-semibold text-sm">{escolaToView.decreto_criacao || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">E-mail</Label>
                                        <p className="font-medium text-sm">{escolaToView.email || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">Contato (Contato)</Label>
                                        <p className="font-medium text-sm">{escolaToView.contato || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">Zona</Label>
                                        <p className="font-medium text-sm">{escolaToView.zona || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground text-xs">Horário de Funcionamento</Label>
                                        <p className="font-medium text-sm">{escolaToView.horario_funcionamento || '-'}</p>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-muted-foreground text-xs">Endereço Completo</Label>
                                        <p className="font-medium text-sm">{escolaToView.endereco || '-'}</p>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-2">
                                    <h4 className="text-sm font-semibold mb-3">Estrutura Física</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Salas de Aula</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.salas_aula || '0'}</p>
                                        </div>
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Laboratórios</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.laboratorios || '0'}</p>
                                        </div>
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Banheiros</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.banheiros || '0'}</p>
                                        </div>
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Cantina</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.cantina || '0'}</p>
                                        </div>
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Biblioteca</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.biblioteca || '0'}</p>
                                        </div>
                                        <div className="space-y-1 bg-muted/30 p-2 rounded">
                                            <Label className="text-muted-foreground text-[10px] uppercase">Quadras</Label>
                                            <p className="font-bold text-center text-lg">{escolaToView.quadras || '0'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Fechar</Button>
                            {isAdmin && escolaToView && (
                                <Button onClick={() => navigate(`/escolas/${escolaToView.inep}/editar`)} className="bg-blue-600 hover:bg-blue-700">
                                    Editar Detalhes
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </AppLayout>
    );
}
