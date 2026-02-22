import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { format, isSameDay, isSameMonth, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  data: Timestamp;
  tipo: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
}

export default function Calendario() {
  const { role } = useUserRole();
  const isAdminOrGestor = role === 'admin' || role === 'gestor';
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<Evento | null>(null);
  const [eventoToEdit, setEventoToEdit] = useState<Evento | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    titulo: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    tipo: 'evento escolar',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    local: '',
  });

  useEffect(() => {
    fetchEventos();
    fetchDiasLetivos();
  }, [currentMonth]);

  async function fetchEventos() {
    setLoading(true);
    try {
      const q = query(collection(db, 'eventos'), orderBy('data', 'asc'));
      const querySnapshot = await getDocs(q);
      const eventosData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Garante que o campo 'data' seja sempre um Timestamp.
        // Converte de string para Timestamp se for o formato antigo.
        if (data.data && typeof data.data === 'string') {
          data.data = Timestamp.fromDate(parseISO(data.data));
        }
        return { id: doc.id, ...data } as Evento;
      });
      setEventos(eventosData);
    } catch (error) {
      toast.error('Erro ao carregar eventos');
      console.error(error);
    }
    setLoading(false);
  }

  async function fetchDiasLetivos() {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const q = query(
        collection(db, 'dias_letivos'),
        orderBy('data', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const dias = new Set<string>();
      
      // Filtrar client-side para simplificar, ou ajustar a query
      querySnapshot.forEach(doc => {
        dias.add(doc.data().data);
      });
      
      setDiasLetivos(dias);
    } catch (error) {
      console.error("Erro ao carregar dias letivos:", error);
    }
  }

  async function toggleDiaLetivo(date: Date) {
    if (!isAdminOrGestor) {
      toast.error('Apenas gestores e administradores podem alterar dias letivos.');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const isLetivo = diasLetivos.has(dateStr);

    try {
      if (isLetivo) {
        // Remover dia letivo
        const q = query(collection(db, 'dias_letivos'), where('data', '==', dateStr));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
        
        const newDias = new Set(diasLetivos);
        newDias.delete(dateStr);
        setDiasLetivos(newDias);
        await logActivity(`marcou o dia ${format(date, 'dd/MM/yyyy')} como NÃO letivo.`);
        toast.success(`Dia ${format(date, 'dd/MM')} marcado como NÃO letivo.`);
      } else {
        // Adicionar dia letivo
        await addDoc(collection(db, 'dias_letivos'), {
          data: dateStr,
          criado_em: new Date(),
          criado_por: 'sistema' // Idealmente o ID do utilizador
        });
        
        const newDias = new Set(diasLetivos);
        newDias.add(dateStr);
        setDiasLetivos(newDias);
        await logActivity(`marcou o dia ${format(date, 'dd/MM/yyyy')} como LETIVO.`);
        toast.success(`Dia ${format(date, 'dd/MM')} marcado como LETIVO.`);
      }
    } catch (error) {
      console.error("Erro ao alterar dia letivo:", error);
      toast.error("Erro ao atualizar o calendário escolar.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const payload = {
      titulo: formData.titulo,
      data: parseISO(formData.data),
      tipo: formData.tipo,
      hora_inicio: formData.hora_inicio,
      hora_fim: formData.hora_fim,
      local: formData.local || null,
    };

    try {
      await addDoc(collection(db, 'eventos'), payload);
      await logActivity(`adicionou o evento "${payload.titulo}" no calendário.`);
      toast.success('Evento adicionado com sucesso!');
      setIsOpen(false);
      resetForm();
      fetchEventos();
    } catch (error) {
      toast.error('Erro ao cadastrar evento');
      console.error(error);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!eventoToEdit) return;
    
    const payload = {
      titulo: formData.titulo,
      data: parseISO(formData.data),
      hora_inicio: formData.hora_inicio,
      tipo: formData.tipo,
      hora_fim: formData.hora_fim,
      local: formData.local || null,
    };

    try {
      const docRef = doc(db, 'eventos', eventoToEdit.id);
      await updateDoc(docRef, payload);
      await logActivity(`atualizou o evento "${payload.titulo}" no calendário.`);
      toast.success('Evento atualizado com sucesso!');
      setIsEditOpen(false);
      setEventoToEdit(null);
      resetForm();
      fetchEventos();
    } catch (error) {
      toast.error('Erro ao atualizar evento');
      console.error(error);
    }
  }

  async function handleDelete() {
    if (!eventoToDelete) return;

    try {
      const docRef = doc(db, 'eventos', eventoToDelete.id);
      await deleteDoc(docRef);
      await logActivity(`excluiu o evento "${eventoToDelete.titulo}" do calendário.`);
      toast.success('Evento excluído com sucesso!');
      setDeleteDialogOpen(false);
      setEventoToDelete(null);
      fetchEventos();
    } catch (error) {
      toast.error('Erro ao excluir evento');
      console.error(error);
    }
  }

  function resetForm() {
    setFormData({
      titulo: '',
      data: format(selectedDate, 'yyyy-MM-dd'),
      tipo: 'evento escolar',
      hora_inicio: '08:00',
      hora_fim: '09:00',
      local: '',
    });
  }

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      setSelectedDate(date);
      setFormData(prev => ({ ...prev, data: format(date, 'yyyy-MM-dd') }));
      
      // Se for duplo clique ou uma ação explícita, alternar dia letivo
      // Mas o componente Calendar do shadcn/ui não suporta onDoubleClick facilmente
      // Vamos adicionar um botão explícito para isso na interface
    }
  }

  function openAddDialog() {
    setFormData({
      titulo: '',
      data: format(selectedDate, 'yyyy-MM-dd'),
      tipo: 'evento escolar',
      hora_inicio: '08:00',
      hora_fim: '09:00',
      local: '',
    });
    setIsOpen(true);
  }

  function openEditDialog(evento: Evento) {
    setEventoToEdit(evento);
    setFormData({
      titulo: evento.titulo,
      data: format(evento.data.toDate(), 'yyyy-MM-dd'),
      hora_inicio: evento.hora_inicio || '08:00',
      tipo: evento.tipo || 'evento escolar',
      hora_fim: evento.hora_fim || '09:00',
      local: evento.local || '',
    });
    setIsEditOpen(true);
  }

  function openDeleteDialog(evento: Evento) {
    setEventoToDelete(evento);
    setDeleteDialogOpen(true);
  }

  const eventosNaDataSelecionada = eventos.filter(e => 
    isSameDay(e.data.toDate(), selectedDate)
  );

  const eventosDoMes = eventos.filter(e => 
    isSameMonth(e.data.toDate(), currentMonth)
  );

  const eventDates = eventos.map(e => e.data.toDate());
  const diasLetivosDates = Array.from(diasLetivos).map(d => parseISO(d));

  return (
    <AppLayout title="Calendário Escolar">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie eventos e defina os dias letivos</p>
        
        <div className="flex justify-end gap-2">
          {isAdminOrGestor && (
            <div className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Modo de Edição: Selecione uma data e clique em "Alternar Dia Letivo"
            </div>
          )}
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Evento
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Calendário */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Calendário</CardTitle>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded-full border border-green-300"></div>
                  <span>Dia Letivo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary/10 rounded-full"></div>
                  <span>Evento</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  onMonthChange={setCurrentMonth}
                  locale={ptBR}
                  className="rounded-md pointer-events-auto"
                  modifiers={{
                    hasEvent: eventDates,
                    isLetivo: diasLetivosDates
                  }}
                  modifiersStyles={{
                    hasEvent: {
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      textDecorationColor: 'hsl(var(--primary))',
                    },
                    isLetivo: {
                      backgroundColor: '#dcfce7', // green-100
                      color: '#166534', // green-800
                      fontWeight: 'bold'
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Detalhes do Dia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                {isAdminOrGestor && (
                  <Button 
                    variant={diasLetivos.has(format(selectedDate, 'yyyy-MM-dd')) ? "destructive" : "outline"} 
                    size="sm"
                    onClick={() => toggleDiaLetivo(selectedDate)}
                    className={diasLetivos.has(format(selectedDate, 'yyyy-MM-dd')) ? "" : "border-green-600 text-green-600 hover:bg-green-50"}
                  >
                    {diasLetivos.has(format(selectedDate, 'yyyy-MM-dd')) ? "Remover Dia Letivo" : "Marcar como Dia Letivo"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Status do Dia</h4>
                {diasLetivos.has(format(selectedDate, 'yyyy-MM-dd')) ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    <CalendarIcon className="h-4 w-4" />
                    Dia Letivo
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    Dia Não Letivo
                  </div>
                )}
              </div>

              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Eventos</h4>
              {eventosNaDataSelecionada.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Não há eventos para esta data.</p>
                  <Button variant="outline" onClick={openAddDialog}>
                    Adicionar um evento
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventosNaDataSelecionada.map((evento) => (
                    <div 
                      key={evento.id} 
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{evento.titulo}</h4>
                          {(evento.hora_inicio || evento.hora_fim) && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {evento.hora_inicio && evento.hora_fim 
                                  ? `${evento.hora_inicio} - ${evento.hora_fim}`
                                  : evento.hora_inicio || evento.hora_fim}
                              </span>
                            </div>
                          )}
                          {evento.local && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{evento.local}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(evento)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(evento)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Todos os eventos do mês */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              Todos os eventos de {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventosDoMes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum evento cadastrado para este mês.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {eventosDoMes.map((evento) => (
                  <div 
                    key={evento.id} 
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{evento.titulo}</h4>
                        <div className="flex items-center gap-1 text-sm text-primary mt-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          <span>{format(evento.data.toDate(), "d 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                        {(evento.hora_inicio || evento.hora_fim) && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {evento.hora_inicio && evento.hora_fim 
                                ? `${evento.hora_inicio} - ${evento.hora_fim}`
                                : evento.hora_inicio || evento.hora_fim}
                            </span>
                          </div>
                        )}
                        {evento.local && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{evento.local}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(evento)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(evento)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para adicionar evento */}
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Evento</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do evento para adicioná-lo ao calendário.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Nome do Evento</Label>
                <Input
                  id="titulo"
                  placeholder="Ex: Reunião de pais"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Evento</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evento escolar">Evento Escolar</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="prova">Prova</SelectItem>
                    <SelectItem value="feriado">Feriado</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="data"
                    type="date"
                    className="pl-10"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hora_inicio" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Hora de Início
                  </Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora_fim" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Hora de Término
                  </Label>
                  <Input
                    id="hora_fim"
                    type="time"
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="local" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Local
                </Label>
                <Input
                  id="local"
                  placeholder="Ex: Auditório da escola"
                  value={formData.local}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Adicionar Evento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para editar evento */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEventoToEdit(null); resetForm(); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Evento</DialogTitle>
              <DialogDescription>
                Atualize os detalhes do evento.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-titulo">Nome do Evento</Label>
                <Input
                  id="edit-titulo"
                  placeholder="Ex: Reunião de pais"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo de Evento</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger id="edit-tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evento escolar">Evento Escolar</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="prova">Prova</SelectItem>
                    <SelectItem value="feriado">Feriado</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-data">Data</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-data"
                    type="date"
                    className="pl-10"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-hora_inicio" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Hora de Início
                  </Label>
                  <Input
                    id="edit-hora_inicio"
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-hora_fim" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Hora de Término
                  </Label>
                  <Input
                    id="edit-hora_fim"
                    type="time"
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-local" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Local
                </Label>
                <Input
                  id="edit-local"
                  placeholder="Ex: Auditório da escola"
                  value={formData.local}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEventoToEdit(null); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o evento "{eventoToDelete?.titulo}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEventoToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
