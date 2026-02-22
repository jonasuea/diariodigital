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
import { Plus, Search, Pencil, ClipboardList, Calendar, FileText, Trash2, Users, BookOpen } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, collectionGroup, getCountFromServer, orderBy, writeBatch } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano: number;
  professor_id: string | null;
  professor_id_2: string | null;
  professores_disciplinas?: { professor_id: string; disciplina: string }[];
  capacidade: number;
  professor_nome?: string;
  professor_nome_2?: string;
  estudantes_count?: number;
}

const DISCIPLINAS = [
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
  historico_academico?: { serie: string; concluido: boolean }[];
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
  
  const [alocarDialogOpen, setAlocarDialogOpen] = useState(false);
  const [turmaParaAlocar, setTurmaParaAlocar] = useState<Turma | null>(null);
  const [alocacaoData, setAlocacaoData] = useState<{ professor_id: string; disciplina: string }[]>([]);
  const [novaAlocacao, setNovaAlocacao] = useState({ professor_id: '', disciplina: '' });

  const [formData, setFormData] = useState({
    nome: '',
    serie: '',
    turno: 'Manhã',
    ano: new Date().getFullYear(),
    professor_id: '',
    professor_id_2: '',
    capacidade: 30,
  });

  useEffect(() => {
    fetchTurmas();
    fetchProfessores();
  }, [search, anoFiltro]);

  async function fetchTurmas() {
    setLoading(true);
    try {
      // Otimização: Carregar todos os professores de uma vez
      const profsQuery = query(collection(db, 'professores'), where('ativo', '==', true));
      const profsSnapshot = await getDocs(profsQuery);
      const profsMap = new Map<string, string>();
      profsSnapshot.forEach(doc => profsMap.set(doc.id, doc.data().nome));


      let turmasQuery = query(
        collection(db, 'turmas'),
        where('ano', '==', parseInt(anoFiltro))
      );

      if (search) {
        turmasQuery = query(
            collection(db, 'turmas'),
            where('ano', '==', parseInt(anoFiltro)),
            where('nome', '>=', search),
            where('nome', '<=', search + '\uf8ff')
        );
      }

      const querySnapshot = await getDocs(turmasQuery);
      const turmasData = await Promise.all(querySnapshot.docs.map(async (turmaDoc) => {
        const turmaData = turmaDoc.data() as Omit<Turma, 'id'>;
        const professor_nome = turmaData.professor_id ? profsMap.get(turmaData.professor_id) : '-';
        const professor_nome_2 = turmaData.professor_id_2 ? profsMap.get(turmaData.professor_id_2) : '-';
        
        const estudantesColl = query(collection(db, "estudantes"), where('turma_id', '==', turmaDoc.id));
        const snapshot = await getCountFromServer(estudantesColl);
        const estudantes_count = snapshot.data().count;

        return {
          id: turmaDoc.id,
          ...turmaData,
          professor_nome,
          professor_nome_2,
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
    try {
      const q = query(collection(db, 'professores'), where('ativo', '==', true), orderBy('nome'));
      const querySnapshot = await getDocs(q);
      setProfessores(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professor)));
    } catch (error) {
      console.error("Error fetching professors: ", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const payload = {
      ...formData,
      professor_id: formData.professor_id || null,
      professor_id_2: formData.professor_id_2 === 'none' ? null : formData.professor_id_2 || null,
    };

    try {
      if (editingTurma) {
        const turmaDocRef = doc(db, 'turmas', editingTurma.id);
        await updateDoc(turmaDocRef, payload);
        await logActivity(`atualizou a turma "${payload.nome}".`);
        toast.success('Turma atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'turmas'), payload);
        await logActivity(`criou a nova turma "${payload.nome}".`);
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
      professor_id: '',
      professor_id_2: '',
      capacidade: 30,
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
      professor_id: turma.professor_id || '',
      professor_id_2: turma.professor_id_2 || '',
      capacidade: turma.capacidade || 30,
    });
    setIsOpen(true);
  }

  function openDeleteDialog(turma: Turma) {
    setTurmaToDelete(turma);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!turmaToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'turmas', turmaToDelete.id));
      await logActivity(`excluiu a turma "${turmaToDelete.nome}".`);
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
    loadEstudantesParaEnturmar(turma.serie);
  }

  async function loadEstudantesParaEnturmar(serie: string) {
    setLoadingEstudantes(true);
    try {
      const q = query(collection(db, 'estudantes'), where('turma_id', '==', null));
      const querySnapshot = await getDocs(q);
      const estudantesSemTurma = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante));
      
      const estudantesFiltrados = estudantesSemTurma.filter(estudante => 
        estudante.historico_academico?.some(h => h.serie === serie && !h.concluido)
      );

      setEstudantesParaEnturmar(estudantesFiltrados);
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
    if (!turmaParaEnturmar) return;

    const estudantesIds = Object.keys(selecaoEstudantes).filter(id => selecaoEstudantes[id]);
    if (estudantesIds.length === 0) {
      toast.info('Nenhum estudante selecionado.');
      return;
    }

    try {
      const batch = writeBatch(db);
      estudantesIds.forEach(id => {
        const estudanteRef = doc(db, 'estudantes', id);
        batch.update(estudanteRef, { turma_id: turmaParaEnturmar.id });
      });
      await batch.commit();
      
      await logActivity(`enturmou ${estudantesIds.length} estudante(s) na turma "${turmaParaEnturmar.nome}".`);
      toast.success(`${estudantesIds.length} estudante(s) enturmado(s) com sucesso!`);
      setEnturmarDialogOpen(false);
      setTurmaParaEnturmar(null);
      setSelecaoEstudantes({});
      fetchTurmas(); // Atualizar contagem de estudantes
    } catch (error) {
      toast.error('Erro ao salvar enturmação.');
      console.error(error);
    }
  }

  function openAlocarDialog(turma: Turma) {
    setTurmaParaAlocar(turma);
    setAlocacaoData(turma.professores_disciplinas || []);
    setAlocarDialogOpen(true);
  }

  function adicionarAlocacao() {
    if (!novaAlocacao.professor_id || !novaAlocacao.disciplina) {
      toast.error('Selecione um professor e uma disciplina.');
      return;
    }
    if (alocacaoData.some(a => a.disciplina === novaAlocacao.disciplina)) {
      toast.warning(`A disciplina ${novaAlocacao.disciplina} já possui um professor alocado.`);
      return;
    }
    setAlocacaoData(prev => [...prev, novaAlocacao]);
    setNovaAlocacao({ professor_id: '', disciplina: '' });
  }

  function removerAlocacao(index: number) {
    setAlocacaoData(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSalvarAlocacao() {
    if (!turmaParaAlocar) return;
    try {
      const turmaRef = doc(db, 'turmas', turmaParaAlocar.id);
      await updateDoc(turmaRef, { professores_disciplinas: alocacaoData });
      await logActivity(`alocou professores de disciplina para a turma "${turmaParaAlocar.nome}".`);
      toast.success('Professores de disciplina salvos com sucesso!');
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
            <DialogContent>
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
                  <Label htmlFor="serie">Ano/Série</Label>
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
                  <Label htmlFor="professor1">Professor Responsável 1 (Monitor)</Label>
                  <Select value={formData.professor_id} onValueChange={(value) => setFormData({ ...formData, professor_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {professores.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>{prof.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="professor2">Professor Responsável 2 (Monitor)</Label>
                  <Select value={formData.professor_id_2} onValueChange={(value) => setFormData({ ...formData, professor_id_2: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar professor (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {professores.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>{prof.nome}</SelectItem>
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
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">Turma</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Monitores</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Período</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Capacidade</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Estudantes</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Ano</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((turma) => (
                  <tr key={turma.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{turma.nome}</td>
                    <td className="p-4"> 
                      <p>{turma.professor_nome || ''}</p>
                      <p>{turma.professor_nome_2 || ''}</p>
                    </td>
                    <td className="p-4">{turma.turno}</td>
                    <td className="p-4">{turma.capacidade}</td>
                    <td className="p-4">{turma.estudantes_count}</td>
                    <td className="p-4">{turma.ano}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEnturmarDialog(turma)}>
                          <Users className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Enturmar</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAlocarDialog(turma)}>
                          <BookOpen className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Disciplinas</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(turma)}>
                          <Pencil className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Editar</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/turmas/${turma.id}/notas`)}>
                          <ClipboardList className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Notas</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/turmas/${turma.id}/frequencia`)}>
                          <Calendar className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Frequência</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openDeleteDialog(turma)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Apagar</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
                Selecione os estudantes da série "{turmaParaEnturmar?.serie}" que deseja adicionar a esta turma. Apenas estudantes sem turma são listados.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
              {loadingEstudantes ? (
                <p>Carregando estudantes...</p>
              ) : estudantesParaEnturmar.length > 0 ? (
                <div className="space-y-2">
                  {estudantesParaEnturmar.map(estudante => (
                    <div key={estudante.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                      <Checkbox
                        id={`estudante-${estudante.id}`}
                        checked={selecaoEstudantes[estudante.id] || false}
                        onCheckedChange={(checked) => handleSelecaoEstudante(estudante.id, !!checked)}
                      />
                      <Label htmlFor={`estudante-${estudante.id}`} className="flex-1 cursor-pointer">
                        {estudante.nome}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setEnturmarDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvarEnturmacao}>Salvar Seleção</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Alocação de Professores por Disciplina */}
        <Dialog open={alocarDialogOpen} onOpenChange={setAlocarDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Alocar Professores por Disciplina</DialogTitle>
              <DialogDescription>
                Gerencie os professores de cada disciplina para a turma: {turmaParaAlocar?.nome}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* List of current allocations */}
              <div className="space-y-2">
                <Label>Alocações Atuais</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                  {alocacaoData.length > 0 ? (
                    alocacaoData.map((aloc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium">{professores.find(p => p.id === aloc.professor_id)?.nome}</p>
                          <p className="text-sm text-muted-foreground">{aloc.disciplina}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removerAlocacao(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center p-4">Nenhum professor de disciplina alocado.</p>
                  )}
                </div>
              </div>
              {/* Form to add new allocation */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Nova Alocação</Label>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="novo-prof" className="text-xs">Professor</Label>
                    <Select value={novaAlocacao.professor_id} onValueChange={(v) => setNovaAlocacao(p => ({...p, professor_id: v}))}>
                      <SelectTrigger id="novo-prof"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="nova-disc" className="text-xs">Disciplina</Label>
                    <Select value={novaAlocacao.disciplina} onValueChange={(v) => setNovaAlocacao(p => ({...p, disciplina: v}))}>
                      <SelectTrigger id="nova-disc"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {DISCIPLINAS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={adicionarAlocacao}>Adicionar</Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAlocarDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvarAlocacao}>Salvar Alocações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}