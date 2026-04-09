import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Clock, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, addDoc, updateDoc, deleteDoc, limit, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { logActivity } from '@/lib/logger';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { TimeTableGeneratorDialog } from '@/components/horarios/TimeTableGeneratorDialog';

interface Turma {
  id: string;
  nome: string;
}

interface Horario {
  id: string;
  turma_ids: string[];
  dia: string;
  inicio: string;
  fim: string;
  componente: string;
}

const DIAS = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
];

const componentes = [
  'Língua Portuguesa',
  'Arte',
  'Educação Física',
  'Língua Inglesa',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Ensino Religioso',
  'Física',
  'Química',
  'Biologia',
  'Filosofia',
  'Sociologia',
];

export default function Horario() {
  const { role, isEstudante, escolaAtivaId } = useUserRole();
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [formData, setFormData] = useState({
    dia: 'segunda',
    inicio: '07:00',
    fim: '08:00',
    componente: '',
    turma_ids: [] as string[],
  });

  useEffect(() => {
    fetchTurmas();
  }, [role, escolaAtivaId, user]);

  useEffect(() => {
    if (selectedTurma) {
      fetchHorarios(selectedTurma.id);
    }
  }, [selectedTurma]);

  useEffect(() => {
    if (isOpen && !editingHorario && selectedTurma) {
      setFormData(prev => ({ ...prev, turma_ids: [selectedTurma.id] }));
    }
  }, [isOpen, editingHorario, selectedTurma]);

  async function fetchTurmas() {
    try {
      if (isEstudante && user) {
        let q = query(collection(db, 'estudantes'), where('usuario_id', '==', user.uid), limit(1));
        let snap = await getDocs(q);

        if (snap.empty && user.email) {
          q = query(collection(db, 'estudantes'), where('email', '==', user.email), limit(1));
          snap = await getDocs(q);

          if (snap.empty) {
            q = query(collection(db, 'estudantes'), where('email_responsavel', '==', user.email), limit(1));
            snap = await getDocs(q);
          }
        }

        if (!snap.empty) {
          const turmaId = snap.docs[0].data().turma_id;
          if (turmaId) {
            const turmaDoc = await getDoc(doc(db, 'turmas', turmaId));
            if (turmaDoc.exists()) {
              const turmaData = { id: turmaDoc.id, ...turmaDoc.data() } as Turma;
              setTurmas([turmaData]);
              setSelectedTurma(turmaData);
            } else {
              setTurmas([]);
            }
          } else {
            setTurmas([]);
          }
        } else {
          setTurmas([]);
        }
      } else if (role === 'professor' && user) {
        // Professor: busca apenas as turmas onde está alocado na escola ativa
        let professorId: string | null = null;

        // Busca o documento do professor pelo uid ou email
        const profByUid = await getDoc(doc(db, 'professores', user.uid));
        if (profByUid.exists()) {
          professorId = user.uid;
        } else if (user.email) {
          const profSnap = await getDocs(
            query(collection(db, 'professores'), where('email', '==', user.email), limit(1))
          );
          if (!profSnap.empty) professorId = profSnap.docs[0].id;
        }

        if (professorId && escolaAtivaId) {
          const q = query(
            collection(db, 'turmas'),
            where('escola_id', '==', escolaAtivaId),
            where('professoresIds', 'array-contains', professorId),
            orderBy('nome')
          );
          const snap = await getDocs(q);
          const turmasData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Turma));
          setTurmas(turmasData);
          if (turmasData.length > 0) setSelectedTurma(turmasData[0]);
        } else {
          setTurmas([]);
        }
      } else {
        // Gestor/admin: todas as turmas da escola ativa
        const constraints = escolaAtivaId
          ? [where('escola_id', '==', escolaAtivaId), orderBy('nome')]
          : [orderBy('nome')];
        const q = query(collection(db, 'turmas'), ...constraints);
        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
        setTurmas(turmasData);
        if (turmasData.length > 0) {
          setSelectedTurma(turmasData[0]);
        }
      }
    } catch (error) {
      toast.error('Sem permissão para carregar turmas');
      console.error(error);
    }
    setLoading(false);
  }

  async function fetchHorarios(turmaId: string) {
    setLoading(true);
    try {
      const q = query(collection(db, 'horarios'), where('turma_ids', 'array-contains', turmaId), orderBy('inicio'));
      const querySnapshot = await getDocs(q);
      const horariosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Horario));
      setHorarios(horariosData);
    } catch (error) {
      toast.error('Sem permissão para carregar horários');
      console.error(error);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.turma_ids.length === 0) {
      toast.error('Por favor, selecione ao menos uma turma.');
      return;
    }

    const payload = {
      turma_ids: formData.turma_ids,
      dia: formData.dia,
      inicio: formData.inicio,
      fim: formData.fim,
      componente: formData.componente,
      escola_id: escolaAtivaId,
      escola_ids: [escolaAtivaId],
    };

    try {
      if (editingHorario) {
        const docRef = doc(db, 'horarios', editingHorario.id);
        await updateDoc(docRef, payload);
        await logActivity(`atualizou o horário de ${payload.componente} para as turmas selecionadas.`);
        toast.success('Horário atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'horarios'), payload);
        await logActivity(`cadastrou um novo horário de ${payload.componente} para as turmas selecionadas.`);
        toast.success('Horário cadastrado com sucesso!');
      }
      setIsOpen(false);
      resetForm();
      if (selectedTurma) {
        fetchHorarios(selectedTurma.id);
      }
    } catch (error) {
      toast.error(editingHorario ? 'Sem permissão para atualizar horário' : 'Sem permissão para cadastrar horário');
      console.error(error);
    }
  }

  async function handleDelete(horario: Horario) {
    if (!confirm('Deseja realmente excluir este horário?')) return;

    try {
      const docRef = doc(db, 'horarios', horario.id);
      await deleteDoc(docRef);
      await logActivity(`excluiu o horário de ${horario.componente} de ${horario.inicio} às ${horario.fim}.`);
      toast.success('Horário excluído com sucesso!');
      if (selectedTurma) fetchHorarios(selectedTurma.id);
    } catch (error) {
      toast.error('Sem permissão para excluir horário');
      console.error(error);
    }
  }

  function resetForm() {
    setFormData({
      dia: 'segunda',
      inicio: '07:00',
      fim: '08:00',
      componente: '',
      turma_ids: [],
    });
    setEditingHorario(null);
  }

  function openEdit(horario: Horario) {
    setEditingHorario(horario);
    setFormData({
      dia: horario.dia,
      inicio: horario.inicio,
      fim: horario.fim,
      componente: horario.componente,
      turma_ids: horario.turma_ids || [],
    });
    setIsOpen(true);
  }

  const getHorariosByDia = (dia: string) => horarios.filter(h => h.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <AppLayout title="Horário">
      <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
        {/* Sidebar com turmas */}
        <div className="w-full md:w-64 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Turmas</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {turmas.map((turma) => (
                  <button
                    key={turma.id}
                    onClick={() => setSelectedTurma(turma)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedTurma?.id === turma.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {turma.nome}
                  </button>
                ))}
                {turmas.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma turma cadastrada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grade de horários */}
        <div className="flex-1">
          {selectedTurma ? (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <CardTitle className="text-xl md:text-2xl font-bold leading-tight">
                  Horário da {selectedTurma.nome}
                </CardTitle>
                {role !== 'professor' && role !== 'estudante' && (
                  <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="hidden sm:flex">
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar Horário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingHorario ? 'Editar Horário' : 'Novo Horário'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Turmas</Label>
                          <div className="max-h-32 overflow-y-auto space-y-2 rounded-md border p-2 bg-muted/50">
                            {turmas.map(turma => (
                              <div key={turma.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`turma-dialog-${turma.id}`}
                                  checked={formData.turma_ids.includes(turma.id)}
                                  onCheckedChange={(checked) => {
                                    const newTurmaIds = checked
                                      ? [...formData.turma_ids, turma.id]
                                      : formData.turma_ids.filter(id => id !== turma.id);
                                    setFormData({ ...formData, turma_ids: newTurmaIds });
                                  }}
                                />
                                <Label htmlFor={`turma-dialog-${turma.id}`} className="font-normal cursor-pointer">
                                  {turma.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dia">Dia da Semana</Label>
                          <Select value={formData.dia} onValueChange={(value) => setFormData({ ...formData, dia: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DIAS.map((dia) => (
                                <SelectItem key={dia.value} value={dia.value}>
                                  {dia.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="componente">componente</Label>
                          <Select value={formData.componente} onValueChange={(value) => setFormData({ ...formData, componente: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a componente" />
                            </SelectTrigger>
                            <SelectContent>
                              {componentes.map((disc) => (
                                <SelectItem key={disc} value={disc}>
                                  {disc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="inicio">Início</Label>
                            <Input
                              id="inicio"
                              type="time"
                              value={formData.inicio}
                              onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fim">Fim</Label>
                            <Input
                              id="fim"
                              type="time"
                              value={formData.fim}
                              onChange={(e) => setFormData({ ...formData, fim: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                            Cancelar
                          </Button>
                          <Button type="submit">
                            {editingHorario ? 'Salvar' : 'Cadastrar'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}

                {role !== 'professor' && role !== 'estudante' && (
                  <Button size="sm" onClick={() => setIsGeneratorOpen(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Gerador de Horário
                  </Button>
                )}

                {isGeneratorOpen && (
                  <TimeTableGeneratorDialog
                    open={isGeneratorOpen}
                    onOpenChange={setIsGeneratorOpen}
                    turma={selectedTurma as any}
                    onSuccess={() => selectedTurma && fetchHorarios(selectedTurma.id)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {DIAS.map((dia) => (
                      <div key={dia.value} className="space-y-2">
                        <h4 className="font-semibold text-center text-sm py-2 bg-muted rounded-lg">
                          {dia.label}
                        </h4>
                        <div className="space-y-2 min-h-[200px]">
                          {getHorariosByDia(dia.value).map((horario) => (
                            <div
                              key={horario.id}
                              className="p-3 bg-primary/5 border border-primary/20 rounded-lg group relative"
                            >
                              <p className="font-medium text-sm text-foreground">{horario.componente}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {horario.inicio} - {horario.fim}
                              </p>
                              {role !== 'professor' && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(horario)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(horario)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          {getHorariosByDia(dia.value).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Sem aulas
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Selecione uma turma para ver os horários</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}