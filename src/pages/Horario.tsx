import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Turma {
  id: string;
  nome: string;
}

interface Horario {
  id: string;
  turma_id: string;
  dia: string;
  inicio: string;
  fim: string;
  disciplina: string;
}

const DIAS = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
];

export default function Horario() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [formData, setFormData] = useState({
    dia: 'segunda',
    inicio: '07:00',
    fim: '08:00',
    disciplina: '',
  });

  useEffect(() => {
    fetchTurmas();
  }, []);

  useEffect(() => {
    if (selectedTurma) {
      fetchHorarios(selectedTurma.id);
    }
  }, [selectedTurma]);

  async function fetchTurmas() {
    try {
      const q = query(collection(db, 'turmas'), orderBy('nome'));
      const querySnapshot = await getDocs(q);
      const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
      setTurmas(turmasData);
      if (turmasData.length > 0) {
        setSelectedTurma(turmasData[0]);
      }
    } catch (error) {
      toast.error('Erro ao carregar turmas');
      console.error(error);
    }
    setLoading(false);
  }

  async function fetchHorarios(turmaId: string) {
    setLoading(true);
    try {
      const q = query(collection(db, 'horarios'), where('turma_id', '==', turmaId), orderBy('inicio'));
      const querySnapshot = await getDocs(q);
      const horariosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Horario));
      setHorarios(horariosData);
    } catch (error) {
      toast.error('Erro ao carregar horários');
      console.error(error);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTurma) return;
    
    const payload = {
      turma_id: selectedTurma.id,
      dia: formData.dia,
      inicio: formData.inicio,
      fim: formData.fim,
      disciplina: formData.disciplina,
    };

    try {
      if (editingHorario) {
        const docRef = doc(db, 'horarios', editingHorario.id);
        await updateDoc(docRef, payload);
        toast.success('Horário atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'horarios'), payload);
        toast.success('Horário cadastrado com sucesso!');
      }
      setIsOpen(false);
      resetForm();
      fetchHorarios(selectedTurma.id);
    } catch (error) {
      toast.error(editingHorario ? 'Erro ao atualizar horário' : 'Erro ao cadastrar horário');
      console.error(error);
    }
  }

  async function handleDelete(horario: Horario) {
    if (!confirm('Deseja realmente excluir este horário?')) return;
    
    try {
      const docRef = doc(db, 'horarios', horario.id);
      await deleteDoc(docRef);
      toast.success('Horário excluído com sucesso!');
      if (selectedTurma) fetchHorarios(selectedTurma.id);
    } catch (error) {
      toast.error('Erro ao excluir horário');
      console.error(error);
    }
  }

  function resetForm() {
    setFormData({
      dia: 'segunda',
      inicio: '07:00',
      fim: '08:00',
      disciplina: '',
    });
    setEditingHorario(null);
  }

  function openEdit(horario: Horario) {
    setEditingHorario(horario);
    setFormData({
      dia: horario.dia,
      inicio: horario.inicio,
      fim: horario.fim,
      disciplina: horario.disciplina,
    });
    setIsOpen(true);
  }

  const getHorariosByDia = (dia: string) => horarios.filter(h => h.dia === dia);

  return (
    <AppLayout title="Horário">
      <div className="flex gap-6 animate-fade-in">
        {/* Sidebar com turmas */}
        <div className="w-64 flex-shrink-0">
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
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle>Horário da {selectedTurma.nome}</CardTitle>
                <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Configurar Horário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingHorario ? 'Editar Horário' : 'Novo Horário'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                        <Label htmlFor="disciplina">Disciplina</Label>
                        <Input
                          id="disciplina"
                          value={formData.disciplina}
                          onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })}
                          required
                        />
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
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-4">
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
                              <p className="font-medium text-sm text-foreground">{horario.disciplina}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {horario.inicio} - {horario.fim}
                              </p>
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(horario)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(horario)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
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