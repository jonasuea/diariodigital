import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, ClipboardList, Calendar, Trash2, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, collectionGroup, getCountFromServer, orderBy, writeBatch } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

interface ComponenteCurricular {
  nome: string;
  professorId: string;
  professorNome?: string;
}

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano: number;
  capacidade: number;
  componentes: ComponenteCurricular[];
  professoresIds: string[]; // Para facilitar a busca
  monitoresIds?: string[]; // IDs dos monitores da turma
  estudantes_count?: number;
}

const COMPONENTES_CURRICULARES = [
  'Língua Portuguesa',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Arte',
  'Educação Física',
  'Inglês',
  'Ensino Religioso',
  'Física',
  'Química',
  'Biologia',
  'Filosofia',
  'Sociologia',
];

interface Professor {
  id: string;
  nome: string;
}

interface Estudante {
  id: string;
  nome: string;
  matricula?: string;
  status?: string;
  turma_id?: string | null;
}

export default function Turmas() {
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear().toString());
  const [isOpen, setIsOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [turmaToDelete, setTurmaToDelete] = useState<Turma | null>(null);
  const [enturmarDialogOpen, setEnturmarDialogOpen] = useState(false);
  const [turmaParaEnturmar, setTurmaParaEnturmar] = useState<Turma | null>(null);
  const [estudantesParaEnturmar, setEstudantesParaEnturmar] = useState<Estudante[]>([]);
  const [selecaoEstudantes, setSelecaoEstudantes] = useState<Record<string, boolean>>({});
  const [loadingEstudantes, setLoadingEstudantes] = useState(false);
  const [buscaEnturmar, setBuscaEnturmar] = useState("");

  const [alocarDialogOpen, setAlocarDialogOpen] = useState(false);
  const [turmaParaAlocar, setTurmaParaAlocar] = useState<Turma | null>(null);
  const [alocacaoData, setAlocacaoData] = useState<Omit<ComponenteCurricular, 'professorNome'>[]>([]);
  const [novaAlocacao, setNovaAlocacao] = useState({ professorId: '', nome: '' });

  const { user } = useAuth();
  const { escolaAtivaId } = useUserRole();

  const [formData, setFormData] = useState({
    nome: '',
    serie: '',
    turno: 'Manhã',
    ano: new Date().getFullYear(),
    capacidade: 30,
    monitoresIds: [] as string[],
  });

  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedTurmas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    fetchTurmas();
    fetchProfessores();
  }, [search, anoFiltro, escolaAtivaId]);

  async function fetchTurmas() {
    if (!escolaAtivaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Otimização: Carregar todos os professores de uma vez da mesma escola
      const profsQuery = query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), where('ativo', '==', true));
      const profsSnapshot = await getDocs(profsQuery);
      const profsMap = new Map<string, string>();
      profsSnapshot.forEach(doc => profsMap.set(doc.id, doc.data().nome));


      let turmasQuery = query(
        collection(db, 'turmas'),
        where('escola_id', '==', escolaAtivaId),
        where('ano', '==', parseInt(anoFiltro))
      );

      if (search) {
        turmasQuery = query(
          collection(db, 'turmas'),
          where('escola_id', '==', escolaAtivaId),
          where('ano', '==', parseInt(anoFiltro)),
          where('nome', '>=', search),
          where('nome', '<=', search + '\uf8ff')
        );
      }

      const querySnapshot = await getDocs(turmasQuery);
      const turmasData = await Promise.all(querySnapshot.docs.map(async (turmaDoc) => {
        const turmaData = turmaDoc.data() as Omit<Turma, 'id'>;

        // Adiciona o nome do professor a cada componente
        const disciplinasComNomes = turmaData.componentes?.map(d => ({
          ...d,
          professorNome: profsMap.get(d.professorId) || 'Não encontrado'
        })) || [];

        const estudantesColl = query(collection(db, "estudantes"), where('turma_id', '==', turmaDoc.id));
        const snapshot = await getCountFromServer(estudantesColl);
        const estudantes_count = snapshot.data().count;

        return {
          id: turmaDoc.id,
          ...turmaData,
          componentes: disciplinasComNomes,
          estudantes_count,
        };
      }));

      setTurmas(turmasData.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      toast.error('Erro ao carregar turmas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfessores() {
    if (!escolaAtivaId) return;
    try {
      const q = query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), where('ativo', '==', true), orderBy('nome'));
      const querySnapshot = await getDocs(q);
      setProfessores(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professor)));
    } catch (error) {
      console.error("Error fetching professors: ", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      toast.error("Você precisa estar autenticado para realizar esta ação.");
      return;
    }

    if (!escolaAtivaId) {
      toast.error("Nenhuma escola selecionada. Operação cancelada.");
      return;
    }

    // O payload não precisa de ajustes, pois o formData já está sem professor_id
    const payload = { ...formData, escola_id: escolaAtivaId };

    try {
      if (editingTurma) {
        const turmaDocRef = doc(db, 'turmas', editingTurma.id);
        await updateDoc(turmaDocRef, payload);
        await logActivity(`(App) ${user.email} atualizou a turma "${payload.nome}".`);
        toast.success('Turma atualizada com sucesso!');
      } else {
        // Para novas turmas, iniciamos com componentes e professores vazios
        const newPayload = { ...payload, componentes: [], professoresIds: [] };
        await addDoc(collection(db, 'turmas'), newPayload);
        await logActivity(`(App) ${user.email} criou a nova turma "${payload.nome}".`);
        toast.success('Turma cadastrada com sucesso!');
      }

      setIsOpen(false);
      resetForm();
      fetchTurmas();
    } catch (error) {
      toast.error(editingTurma ? 'Erro ao atualizar turma' : 'Erro ao cadastrar turma');
      console.error(error);
    }
  }

  function resetForm() {
    setFormData({
      nome: '',
      serie: '',
      turno: 'Manhã',
      ano: new Date().getFullYear(),
      capacidade: 30,
      monitoresIds: [],
    });
    setEditingTurma(null);
  }

  function openEdit(turma: Turma) {
    setEditingTurma(turma);
    setFormData({
      nome: turma.nome,
      serie: turma.serie,
      turno: turma.turno,
      ano: turma.ano,
      capacidade: turma.capacidade || 30,
      monitoresIds: turma.monitoresIds || [],
    });
    setIsOpen(true);
  }

  function openDeleteDialog(turma: Turma) {
    setTurmaToDelete(turma);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!turmaToDelete || !user) return;

    try {
      await deleteDoc(doc(db, 'turmas', turmaToDelete.id));
      await logActivity(`(App) ${user.email} excluiu a turma "${turmaToDelete.nome}".`);
      toast.success('Turma excluída com sucesso!');
      setDeleteDialogOpen(false);
      setTurmaToDelete(null);
      fetchTurmas();
    } catch (error) {
      toast.error('Erro ao excluir turma');
      console.error(error);
    }
  }

  function openEnturmarDialog(turma: Turma) {
    setTurmaParaEnturmar(turma);
    setEnturmarDialogOpen(true);
    loadEstudantesParaEnturmar();
  }

  async function loadEstudantesParaEnturmar() {
    setLoadingEstudantes(true);
    try {
      // Busca todos os estudantes sem filtros no Firestore para evitar
      // a necessidade de índices compostos. Filtragem feita no cliente.
      const querySnapshot = await getDocs(collection(db, 'estudantes'));
      // Bloqueia apenas estudantes definitivamente inativos;
      // 'Transferido' é permitido pois o estudante pode retornar e ser re-enturmado
      const STATUS_BLOQUEADOS = ['Desistente', 'Concludente', 'Inativo'];
      const semTurma = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Estudante))
        .filter(e => !e.turma_id && !STATUS_BLOQUEADOS.includes(e.status || ''))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setEstudantesParaEnturmar(semTurma);
    } catch (error) {
      toast.error('Erro ao carregar estudantes para enturmação.');
      console.error(error);
    } finally {
      setLoadingEstudantes(false);
    }
  }

  function handleSelecaoEstudante(estudanteId: string, checked: boolean) {
    setSelecaoEstudantes(prev => ({ ...prev, [estudanteId]: checked }));
  }

  async function handleSalvarEnturmacao() {
    if (!turmaParaEnturmar || !user) return;

    const estudantesIds = Object.keys(selecaoEstudantes).filter(id => selecaoEstudantes[id]);
    if (estudantesIds.length === 0) {
      toast.info('Nenhum estudante selecionado.');
      return;
    }

    try {
      const anoAtual = new Date().getFullYear().toString();

      // Busca o nome da escola nas configurações
      let nomeEscola = '';
      try {
        const configSnap = await getDoc(doc(db, 'configuracoes', 'escola'));
        if (configSnap.exists()) nomeEscola = configSnap.data()?.escolaConfig?.nome || '';
      } catch { /* silencia erro — campo fica vazio */ }

      const batch = writeBatch(db);

      // Atualiza turma_id de cada estudante
      estudantesIds.forEach(id => {
        const estudanteRef = doc(db, 'estudantes', id);
        const estudante = estudantesParaEnturmar.find(e => e.id === id);
        const updates: Record<string, any> = { turma_id: turmaParaEnturmar.id };
        // Se estava com status Transferido, volta para Frequentando ao ser enturmado novamente
        if (estudante?.status === 'Transferido') {
          updates.status = 'Frequentando';
        }
        batch.update(estudanteRef, updates);
      });
      await batch.commit();

      // Após enturmar, atualiza o histórico acadêmico de cada estudante
      // Faz leituras individuais para verificar duplicidade antes de inserir
      await Promise.all(estudantesIds.map(async (estudanteId) => {
        const estudanteRef = doc(db, 'estudantes', estudanteId);
        const estudanteSnap = await getDoc(estudanteRef);
        if (!estudanteSnap.exists()) return;

        const dados = estudanteSnap.data();
        const historicoAtual: any[] = dados.historico_academico || [];

        const idxExistente = historicoAtual.findIndex(
          h => h.ano_letivo === anoAtual && h.serie === (turmaParaEnturmar.serie || '')
        );

        if (idxExistente !== -1) {
          // Entrada do ano já existe
          const entradaExistente = historicoAtual[idxExistente];
          if (entradaExistente.concluido) return; // Ano concluído: não altera escola

          // Ano não concluído (transferência de escola): atualiza só o nome da escola
          const novoHistorico = [...historicoAtual];
          novoHistorico[idxExistente] = { ...entradaExistente, escola: nomeEscola };
          await updateDoc(estudanteRef, { historico_academico: novoHistorico });
          return;
        }

        // Cria a nova entrada de histórico com os componentes da turma
        const novaEntrada = {
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ano_letivo: anoAtual,
          serie: turmaParaEnturmar.serie || '',
          escola: nomeEscola,
          concluido: false,
          componentes: (turmaParaEnturmar.componentes || []).map((c, i) => ({
            id: `disc_${Date.now()}_${i}`,
            nome: c.nome,
            nota_b1: '',
            nota_b2: '',
            nota_b3: '',
            nota_b4: '',
            media_final: '',
          })),
        };

        await updateDoc(estudanteRef, {
          historico_academico: [...historicoAtual, novaEntrada],
        });
      }));

      await logActivity(`(App) ${user.email} enturmou ${estudantesIds.length} estudante(s) na turma "${turmaParaEnturmar.nome}" e registrou histórico automático.`);
      toast.success(`${estudantesIds.length} estudante(s) enturmado(s) com sucesso! Histórico acadêmico atualizado.`);
      setEnturmarDialogOpen(false);
      setTurmaParaEnturmar(null);
      setSelecaoEstudantes({});
      fetchTurmas();
    } catch (error) {
      toast.error('Erro ao salvar enturmação.');
      console.error(error);
    }
  }

  function openAlocarDialog(turma: Turma) {
    setTurmaParaAlocar(turma);
    // Remove o campo professorNome antes de colocar no estado de edição
    const disciplinasParaEdicao = turma.componentes?.map(({ nome, professorId }) => ({ nome, professorId })) || [];
    setAlocacaoData(disciplinasParaEdicao);
    setAlocarDialogOpen(true);
  }

  function adicionarAlocacao() {
    if (!novaAlocacao.professorId || !novaAlocacao.nome) {
      toast.error('Selecione um professor e um componente curricular.');
      return;
    }
    if (alocacaoData.some(a => a.nome === novaAlocacao.nome)) {
      toast.warning(`O componente curricular ${novaAlocacao.nome} já possui um professor alocado.`);
      return;
    }
    setAlocacaoData(prev => [...prev, novaAlocacao]);
    setNovaAlocacao({ professorId: '', nome: '' });
  }

  function removerAlocacao(disciplinaNome: string) {
    setAlocacaoData(prev => prev.filter(d => d.nome !== disciplinaNome));
  }

  async function handleSalvarAlocacao() {
    if (!turmaParaAlocar || !user) return;

    // Criar o array de IDs de professores para facilitar as queries
    const professoresIds = [...new Set(alocacaoData.map(d => d.professorId))];

    try {
      const turmaRef = doc(db, 'turmas', turmaParaAlocar.id);
      await updateDoc(turmaRef, {
        componentes: alocacaoData,
        professoresIds: professoresIds
      });
      await logActivity(`(App) ${user.email} alocou professores para a turma "${turmaParaAlocar.nome}".`);
      toast.success('Alocação de professores salva com sucesso!');
      setAlocarDialogOpen(false);
      setTurmaParaAlocar(null);
      setAlocacaoData([]);
      fetchTurmas();
    } catch (error) {
      toast.error('Erro ao salvar alocação de professores.');
      console.error(error);
    }
  }

  return (
    <AppLayout title="Turmas">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie todas as turmas da escola</p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ano Letivo:</span>
            <Select value={anoFiltro} onValueChange={setAnoFiltro}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((ano) => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar turmas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1" />

          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Nova Turma</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTurma ? 'Editar Turma' : 'Adicionar Nova Turma'}</DialogTitle>
                <p className="text-sm text-muted-foreground">Preencha os campos abaixo para criar uma nova turma.</p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Turma</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: 7A, 8B, etc."
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serie">Classificação</Label>
                  <Select value={formData.serie} onValueChange={(value) => setFormData({ ...formData, serie: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar ano/série" />
                    </SelectTrigger>
                    <SelectContent>
                      {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano'].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacidade">Capacidade da Sala</Label>
                  <Input
                    id="capacidade"
                    type="number"
                    value={formData.capacidade}
                    onChange={(e) => setFormData({ ...formData, capacidade: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodo">Período</Label>
                  <Select value={formData.turno} onValueChange={(value) => setFormData({ ...formData, turno: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manhã">Manhã</SelectItem>
                      <SelectItem value="Tarde">Tarde</SelectItem>
                      <SelectItem value="Noite">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monitores da Turma (Opcional)</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
                    {professores.map(prof => (
                      <div key={prof.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`monitor-${prof.id}`}
                          checked={formData.monitoresIds.includes(prof.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, monitoresIds: [...prev.monitoresIds, prof.id] }));
                            } else {
                              setFormData(prev => ({ ...prev, monitoresIds: prev.monitoresIds.filter(id => id !== prof.id) }));
                            }
                          }}
                        />
                        <Label htmlFor={`monitor-${prof.id}`} className="font-normal cursor-pointer">
                          {prof.nome}
                        </Label>
                      </div>
                    ))}
                    {professores.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">Nenhum professor/monitor encontrado.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTurma ? 'Salvar' : 'Criar Turma'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visualização Mobile: Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {turmas.map((turma) => (
                <Card key={turma.id} className="overflow-hidden border-border/60 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    {/* Linha 1: Turma | Monitores/Professores | Período */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div
                          className="flex items-center gap-1.5 font-bold text-lg text-primary cursor-pointer"
                          onClick={() => toggleExpand(turma.id)}
                        >
                          {turma.nome}
                          {expandedTurmas[turma.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        <div className="mt-1">
                          {turma.monitoresIds && turma.monitoresIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {turma.monitoresIds.map(monitorId => {
                                const pName = professores.find(p => p.id === monitorId)?.nome;
                                return pName ? (
                                  <span key={monitorId} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                    {pName}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Sem monitores</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full">
                          {turma.turno}
                        </span>
                      </div>
                    </div>

                    {/* Detalhes Expandidos (Professores/Componentes) */}
                    {expandedTurmas[turma.id] && (
                      <div className="p-3 bg-muted/40 rounded-md text-xs border animate-in fade-in slide-in-from-top-1">
                        <strong className="block mb-2 text-foreground/80">Professores e Componentes:</strong>
                        {turma.componentes && turma.componentes.length > 0 ? (
                          <ul className="space-y-1">
                            {turma.componentes.map(d => (
                              <li key={d.nome} className="text-muted-foreground">
                                <span className="font-medium text-foreground">{d.nome}:</span> {d.professorNome}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">Nenhum professor alocado</span>
                        )}
                      </div>
                    )}

                    {/* Linha 2: Vagas | Estudantes | Ano | Ações */}
                    <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t">
                      <div className="flex gap-3 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                        <div>
                          Vagas: <span className="text-foreground">{turma.capacidade - (turma.estudantes_count || 0)}</span>
                        </div>
                        <div>
                          Estudantes: <span className="text-foreground">{turma.estudantes_count}</span>
                        </div>
                        <div>
                          Ano: <span className="text-foreground">{turma.ano}</span>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEnturmarDialog(turma)} title="Enturmar">
                          <Users className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAlocarDialog(turma)} title="Alocar">
                          <BookOpen className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/turmas/${turma.id}/notas`)} title="Notas">
                          <ClipboardList className="h-4 w-4 text-yellow-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(turma)} title="Editar">
                          <Pencil className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteDialog(turma)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Visualização Desktop: Tabela */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Turma</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Monitores/Professores</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Período</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Vagas</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Estudantes</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Ano</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {turmas.map((turma) => (
                    <tr key={turma.id} className="border-t hover:bg-muted/30">
                      <td className="p-4">
                        <div
                          className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors select-none"
                          onClick={() => toggleExpand(turma.id)}
                        >
                          {turma.nome}
                          {expandedTurmas[turma.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </td>
                      <td className="p-4">
                        {turma.monitoresIds && turma.monitoresIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {turma.monitoresIds.map(monitorId => {
                              const pName = professores.find(p => p.id === monitorId)?.nome;
                              return pName ? (
                                <span key={monitorId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {pName}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Sem monitores</span>
                        )}

                        {expandedTurmas[turma.id] && (
                          <div className="mt-4 p-3 bg-muted/40 rounded-md text-sm border min-w-[250px]">
                            <strong className="block mb-2 text-foreground/80">Professores e Componentes:</strong>
                            {turma.componentes && turma.componentes.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1">
                                {turma.componentes.map(d => (
                                  <li key={d.nome} className="text-muted-foreground">
                                    <span className="font-medium text-foreground">{d.nome}:</span> {d.professorNome}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-muted-foreground italic">Nenhum professor/componente alocado</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">{turma.turno}</td>
                      <td className="p-4">{turma.capacidade - (turma.estudantes_count || 0)}</td>
                      <td className="p-4">{turma.estudantes_count}</td>
                      <td className="p-4">{turma.ano}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEnturmarDialog(turma)} title="Enturmar Estudantes">
                            <Users className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openAlocarDialog(turma)} title="Alocar Professores">
                            <BookOpen className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/turmas/${turma.id}/notas`)} title="Notas Bimestrais">
                            <ClipboardList className="h-4 w-4 text-yellow-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/turmas/${turma.id}/frequencia`)} title="Frequência">
                            <Calendar className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(turma)} title="Editar Turma">
                            <Pencil className="h-4 w-4 text-orange-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openDeleteDialog(turma)} title="Excluir Turma" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a turma "{turmaToDelete?.nome}"?
              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Enturmação */}
      <Dialog open={enturmarDialogOpen} onOpenChange={setEnturmarDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enturmar Estudantes na Turma: {turmaParaEnturmar?.nome}</DialogTitle>
            <DialogDescription>
              Selecione os estudantes que deseja adicionar a esta turma. Apenas estudantes com status "Frequentando" e sem turma são listados.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estudante por nome ou matrícula..."
                value={buscaEnturmar}
                onChange={e => setBuscaEnturmar(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-1 mt-2 border rounded-md">
            {loadingEstudantes ? (
              <p>Carregando estudantes...</p>
            ) : estudantesParaEnturmar.length > 0 ? (
              <div className="space-y-1">
                {estudantesParaEnturmar
                  .filter(e => e.nome.toLowerCase().includes(buscaEnturmar.toLowerCase()) || e.matricula?.toLowerCase().includes(buscaEnturmar.toLowerCase()))
                  .map(estudante => (
                    <div key={estudante.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                      <Checkbox
                        id={`estudante-${estudante.id}`}
                        checked={selecaoEstudantes[estudante.id] || false}
                        onCheckedChange={(checked) => handleSelecaoEstudante(estudante.id, !!checked)}
                      />
                      <Label htmlFor={`estudante-${estudante.id}`} className="flex-1 cursor-pointer">
                        {estudante.nome}
                        {estudante.matricula && <span className="ml-2 text-xs text-muted-foreground">({estudante.matricula})</span>}
                      </Label>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum estudante elegível encontrado para esta série.
              </p>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {Object.values(selecaoEstudantes).filter(Boolean).length} estudante(s) selecionado(s) de um total de {estudantesParaEnturmar.length} sem turma.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnturmarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarEnturmacao}>Salvar Seleção</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Alocar Professores */}
      <Dialog open={alocarDialogOpen} onOpenChange={setAlocarDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Alocar Professores por Componente Curricular</DialogTitle>
            <DialogDescription>
              Vincule professores aos componentes curriculares para a turma: {turmaParaAlocar?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Formulário de Nova Alocação */}
            <div className="space-y-4 p-4 border rounded-md">
              <h4 className="font-semibold text-lg">Adicionar Componente</h4>
              <div className="space-y-2">
                <Label>Componente Curricular</Label>
                <Select value={novaAlocacao.nome} onValueChange={(value) => setNovaAlocacao(prev => ({ ...prev, nome: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione the componente" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENTES_CURRICULARES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select value={novaAlocacao.professorId} onValueChange={(value) => setNovaAlocacao(prev => ({ ...prev, professorId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione the professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={adicionarAlocacao} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            {/* Lista de Alocações Atuais */}
            <div className="space-y-2">
              <h4 className="font-semibold text-lg mb-2">Alocações Atuais</h4>
              {alocacaoData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum componente adicionado ainda.</p>
              ) : (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {alocacaoData.map((alocacao, index) => {
                    const professor = professores.find(p => p.id === alocacao.professorId);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{alocacao.nome}</p>
                          <p className="text-sm text-muted-foreground">{professor?.nome || 'Professor não encontrado'}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removerAlocacao(alocacao.nome)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAlocarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarAlocacao}>Salvar Alocações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}