import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Calendar, CheckCircle, XCircle, FileText } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, subDays, isBefore, startOfDay, isSameWeek, isAfter } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
  estudante_pcd?: boolean;
}

interface FrequenciaRecord {
  id?: string;
  estudante_id: string;
  turma_id: string;
  data: string;
  status: 'presente' | 'faltou' | 'justificado';
  justificativa?: string;
  componente?: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  componentes?: { nome: string; professorId: string }[];
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Frequencia() {
  const navigate = useNavigate();
  const { turmaId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, isGestor, isAdmin, escolaAtivaId } = useUserRole();
  const isPrivilegedUser = isAdmin || isGestor || role === 'secretario' || role === 'pedagogo';

  const [turma, setTurma] = useState<Turma | null>(null);
  const [componente, setComponente] = useState(searchParams.get('componente') || '');
  const origem = searchParams.get('origem');
  const isComponenteFixo = origem === 'diario';
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [frequencias, setFrequencias] = useState<Record<string, FrequenciaRecord>>({});
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
  const [justificativaText, setJustificativaText] = useState('');
  const [frequenciaParaJustificar, setFrequenciaParaJustificar] = useState<FrequenciaRecord | null>(null);

  const currentDayRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (turmaId) {
      loadData();
    }
  }, [turmaId, currentMonth, componente, escolaAtivaId]);

  useEffect(() => {
    setSearchParams(prev => {
      if (componente) {
        prev.set('componente', componente);
      } else {
        prev.delete('componente');
      }
      return prev;
    }, { replace: true });
  }, [componente, setSearchParams]);

  async function loadData() {
    if (!turmaId || !escolaAtivaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const turmaDocRef = doc(db, 'turmas', turmaId);
      const turmaDoc = await getDoc(turmaDocRef);
      const turmaData = turmaDoc.exists() ? { id: turmaDoc.id, ...turmaDoc.data() } as Turma : null;
      setTurma(turmaData);

      if (!turmaData) {
        toast.error("Turma não encontrada");
        setLoading(false);
        return;
      }

      const anoTurma = turmaData.ano;

      const estudantesQuery = query(
        collection(db, 'estudantes'),
        where('escola_id', '==', escolaAtivaId),
        where('turma_id', '==', turmaId),
        orderBy('nome')
      );
      const querySnapshot = await getDocs(estudantesQuery);
      setEstudantes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante)));

      const startDate = startOfMonth(new Date(anoTurma, currentMonth));
      const endDate = endOfMonth(new Date(anoTurma, currentMonth));

      const diasLetivosQuery = query(
        collection(db, 'dias_letivos'),
        where('escola_id', '==', escolaAtivaId),
        where('data', '>=', format(startDate, 'yyyy-MM-dd')),
        where('data', '<=', format(endDate, 'yyyy-MM-dd'))
      );
      const diasLetivosSnapshot = await getDocs(diasLetivosQuery);
      const diasLetivosSet = new Set<string>();
      diasLetivosSnapshot.forEach(doc => {
        diasLetivosSet.add(doc.data().data);
      });
      setDiasLetivos(diasLetivosSet);

      if (componente) {
        const freqQuery = query(
          collection(db, 'frequencias'),
          where('escola_id', '==', escolaAtivaId),
          where('turma_id', '==', turmaId),
          where('componente', '==', componente),
          where('data', '>=', format(startDate, 'yyyy-MM-dd')),
          where('data', '<=', format(endDate, 'yyyy-MM-dd'))
        );

        const freqSnapshot = await getDocs(freqQuery);
        const freqData: Record<string, FrequenciaRecord> = {};
        freqSnapshot.forEach(doc => {
          const data = doc.data() as FrequenciaRecord;
          freqData[`${data.estudante_id}-${data.data}`] = { id: doc.id, ...data };
        });
        setFrequencias(freqData);
      } else {
        setFrequencias({});
      }

    } catch (error) {
      toast.error("Sem permissão para carregar dados da frequência");
      console.error(error);
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (currentDayRef.current) {
          currentDayRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 500);
    }
  }

  const anoLetivo = turma?.ano || new Date().getFullYear();

  const schoolDays = (() => {
    try {
      const start = startOfMonth(new Date(anoLetivo, currentMonth));
      const end = endOfMonth(new Date(anoLetivo, currentMonth));
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
      return eachDayOfInterval({ start, end }).map(day => ({
        date: day,
        dayStr: format(day, 'dd'),
        dayName: DIAS_SEMANA[getDay(day)],
      }));
    } catch (e) {
      console.error("Erro ao calcular dias letivos:", e);
      return [];
    }
  })();

  const canEditDate = (date: Date) => {
    if (isPrivilegedUser) return true;

    const hoje = new Date();
    // Não pode editar data futura
    if (isAfter(startOfDay(date), startOfDay(hoje))) return false;

    // Só pode editar se for na mesma semana (Domingo a Sábado)
    return isSameWeek(date, hoje, { weekStartsOn: 0 });
  };

  const toggleFrequencia = async (estudanteId: string, data: Date) => {
    if (!turmaId) return;
    const dateStr = format(data, 'yyyy-MM-dd');

    if (!diasLetivos.has(dateStr)) {
      toast.error('Este dia não está marcado como letivo no calendário escolar.');
      return;
    }

    if (!componente) {
      toast.info('Por favor, selecione um componente curricular para registrar a frequência.');
      return;
    }

    const key = `${estudanteId}-${dateStr}`;
    const existingFreq = frequencias[key];
    const hojeOuPassado = isBefore(data, new Date()) || isSameDay(data, new Date());
    const currentStatus = existingFreq ? existingFreq.status : (hojeOuPassado ? 'presente' : null);
    if (!canEditDate(data)) {
      toast.error('Você só pode editar frequências da semana atual e não pode lançar em dias futuros.');
      return;
    }

    const newStatus: 'presente' | 'faltou' = currentStatus === 'faltou' ? 'presente' : 'faltou';

    const optimisticFreq: FrequenciaRecord = {
      ...existingFreq,
      estudante_id: estudanteId,
      turma_id: turmaId!,
      data: dateStr,
      status: newStatus,
      componente,
    };
    setFrequencias(prev => ({ ...prev, [key]: optimisticFreq }));

    try {
      if (existingFreq?.id) {
        const freqRef = doc(db, 'frequencias', existingFreq.id);
        await updateDoc(freqRef, { status: newStatus });
      } else {
        const docRef = await addDoc(collection(db, 'frequencias'), {
          estudante_id: estudanteId,
          turma_id: turmaId,
          escola_id: escolaAtivaId,
          data: dateStr,
          status: newStatus,
          componente,
          ano: turma?.ano || new Date().getFullYear()
        });
        setFrequencias(prev => ({ ...prev, [key]: { ...optimisticFreq, id: docRef.id } }));
      }
      logActivity(`registrou a frequência para o dia ${dateStr} na turma "${turma?.nome}".`);
    } catch (error) {
      toast.error('Sem permissão para atualizar frequência');
      console.error(error);
      setFrequencias(prev => {
        const reverted = { ...prev };
        if (existingFreq) {
          reverted[key] = existingFreq;
        } else {
          delete reverted[key];
        }
        return reverted;
      });
    }
  };

  const handleJustificativa = async () => {
    if (!frequenciaParaJustificar) return;
    const key = `${frequenciaParaJustificar.estudante_id}-${frequenciaParaJustificar.data}`;

    setFrequencias(prev => ({
      ...prev,
      [key]: { ...frequenciaParaJustificar, status: 'justificado', justificativa: justificativaText }
    }));
    setJustificativaDialogOpen(false);
    toast.success('Falta justificada com sucesso');

    try {
      if (frequenciaParaJustificar.id) {
        const freqRef = doc(db, 'frequencias', frequenciaParaJustificar.id);
        await updateDoc(freqRef, { status: 'justificado', justificativa: justificativaText });
      } else {
        const docRef = await addDoc(collection(db, 'frequencias'), {
          estudante_id: frequenciaParaJustificar.estudante_id,
          turma_id: turmaId!,
          escola_id: escolaAtivaId,
          data: frequenciaParaJustificar.data,
          status: 'justificado',
          justificativa: justificativaText,
          componente,
          ano: turma?.ano || new Date().getFullYear()
        });
        setFrequencias(prev => ({
          ...prev,
          [key]: { ...frequenciaParaJustificar, id: docRef.id, status: 'justificado', justificativa: justificativaText }
        }));
      }
      logActivity(`justificou a falta do dia ${frequenciaParaJustificar.data} na turma "${turma?.nome}".`);
    } catch (error) {
      toast.error('Sem permissão para salvar justificativa');
      console.error(error);
      setFrequencias(prev => ({ ...prev, [key]: frequenciaParaJustificar }));
    }
  };

  const openJustificativaDialog = (estudante: Estudante, dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00'); // Use mid-day to avoid TZ issues
    if (!canEditDate(date)) {
      toast.error('Você só pode editar justificativas da semana atual.');
      return;
    }

    const existingFreq = frequencias[`${estudante.id}-${dateStr}`];
    setFrequenciaParaJustificar(existingFreq || {
      estudante_id: estudante.id,
      turma_id: turmaId!,
      data: dateStr,
      status: 'faltou'
    });
    setJustificativaText(existingFreq?.justificativa || '');
    setJustificativaDialogOpen(true);
  };

  function getStatusIcon(status: string | undefined) {
    switch (status) {
      case 'presente': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'faltou': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'justificado': return <FileText className="h-5 w-5 text-yellow-500" />;
      default: return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  }

  const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const filteredDays = schoolDays.filter(dayObj => {
    const dateStr = format(dayObj.date, 'yyyy-MM-dd');
    return diasLetivos.has(dateStr);
  });

  return (
    <AppLayout title={`Frequência - ${turma?.nome || ''}`}>
      <div className="space-y-4 animate-fade-in w-full" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <p className="text-muted-foreground -mt-1 text-sm">Controle de frequência dos Estudantes - Ano {turma?.ano}</p>

        {/* Linha 1: Voltar */}
        <div>
          <Button variant="outline" onClick={() => navigate(origem === 'diario' ? '/diario-digital' : '/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {origem === 'diario' ? 'Voltar para Diário Digital' : 'Voltar para Turmas'}
          </Button>
        </div>

        {/* Linha 2: Componente + Mês + Ano Letivo (mesma linha no desktop) */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="componente-select">Componente</Label>
            <Select value={componente} onValueChange={setComponente} disabled={isComponenteFixo || !turma?.componentes || turma.componentes.length === 0}>
              <SelectTrigger id="componente-select" className="w-[180px] sm:w-[200px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {turma?.componentes?.map(c => (
                  <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mês:</span>
            <Select value={currentMonth.toString()} onValueChange={(v) => setCurrentMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px] sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((mes, index) => (
                  <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-muted/30 px-3 py-1 rounded-md text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Ano Letivo: {turma?.ano}</span>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-card border rounded-lg p-4 sm:p-6 space-y-4 w-full max-w-full">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Frequência - {MESES[currentMonth]} de {turma?.ano}
              {componente && <span className="text-primary font-bold ml-2">({componente})</span>}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Presente</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Faltou</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-yellow-500" />
              <span>Justificado</span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !componente ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Por favor, selecione um componente curricular para visualizar ou lançar a frequência.</p>
            </div>
          ) : (
            /* Scroll HORIZONTAL — coluna Nome sticky, dias rolam por baixo */
            <div style={{ overflowX: 'auto', width: '100%', borderRadius: '0.5rem', border: '1px solid var(--border)' }} className="-mx-0">
              <table className="border-separate border-spacing-0 w-full sm:w-auto" style={{ minWidth: 'min(100%, 800px)', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    {/* Coluna Estudante — sticky à esquerda */}
                    <th className="text-left px-5 py-2 sticky left-0 z-30 bg-muted border-b border-r shadow-[2px_0_8px_-2px_rgba(0,0,0,0.2)] align-bottom min-w-[150px] w-[150px] sm:min-w-[220px] sm:w-[220px]">
                      Estudante
                    </th>
                    {/* Colunas de dias — rolam normalmente */}
                    {filteredDays.map((dayObj) => {
                      const isToday = isSameDay(dayObj.date, new Date());
                      // Diferença em dias em relação a hoje (negativo = passado)
                      const diffDays = Math.round(
                        (startOfDay(dayObj.date).getTime() - startOfDay(new Date()).getTime()) / 86400000
                      );
                      // Mobile: mostrar hoje (0) e até 2 dias anteriores (-1, -2)
                      const visibleMobile = diffDays >= -2 && diffDays <= 0;

                      return (
                        <th
                          key={dayObj.date.toISOString()}
                          ref={isToday ? currentDayRef : null}
                          className={`p-1 text-center min-w-[44px] border-b
                            ${isToday ? 'bg-blue-100 border-x border-blue-300' : 'bg-muted'}
                            ${!visibleMobile ? 'hidden sm:table-cell' : ''}`}
                        >
                          <div className={`text-[10px] uppercase tracking-tighter ${isToday ? 'text-blue-700 font-bold' : 'text-muted-foreground'}`}>
                            {dayObj.dayName}
                          </div>
                          <div className={`text-sm font-semibold ${isToday ? 'text-blue-800' : ''}`}>
                            {dayObj.dayStr}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {estudantes.map((estudante) => {
                    const faltasCount = filteredDays.reduce((acc, dayObj) => {
                      const key = `${estudante.id}-${format(dayObj.date, 'yyyy-MM-dd')}`;
                      return acc + (frequencias[key]?.status === 'faltou' ? 1 : 0);
                    }, 0);

                    return (
                      <tr key={estudante.id} className="hover:bg-muted/50 transition-colors group">
                        {/* Coluna Nome — sticky, bg sólido para os dias não transparecerem */}
                        <td className="px-3 py-2 border-b border-r bg-background sticky left-0 z-20 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.12)] group-hover:bg-muted/60 transition-colors align-middle min-w-[150px] w-[150px] sm:min-w-[220px] sm:w-[220px]">
                          <span className="font-medium truncate text-sm sm:text-sm flex items-center w-full overflow-hidden" title={estudante.nome}>
                            {estudante.estudante_pcd && (
                              <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mr-1.5 leading-none">
                                DEF
                              </span>
                            )}
                            <span className="truncate">{estudante.nome}</span>
                          </span>
                        </td>
                        {/* Células dos dias */}
                        {filteredDays.map(({ date: dayDate }) => {
                          const dateStr = format(dayDate, 'yyyy-MM-dd');
                          const key = `${estudante.id}-${dateStr}`;
                          let freq = frequencias[key];
                          const isToday = isSameDay(dayDate, new Date());
                          const diffDays = Math.round(
                            (startOfDay(dayDate).getTime() - startOfDay(new Date()).getTime()) / 86400000
                          );
                          const visibleMobile = diffDays >= -2 && diffDays <= 0;

                          if (!freq) {
                            const hojeOuPassado = isBefore(dayDate, new Date()) || isToday;
                            if (hojeOuPassado) {
                              freq = { estudante_id: estudante.id, turma_id: turmaId!, data: dateStr, status: 'presente' };
                            }
                          }

                          return (
                            <td
                              key={dayDate.toISOString()}
                              className={`p-0 text-center border-b align-middle
                                ${isToday ? 'bg-blue-50/50 border-x border-blue-100' : ''}
                                ${!visibleMobile ? 'hidden sm:table-cell' : ''}`}
                            >
                              <div className="flex flex-col items-center justify-center w-full h-full min-h-[48px]">
                                {freq?.status === 'justificado' && freq.justificativa ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => toggleFrequencia(estudante.id, dayDate)}
                                          className="w-11 h-11 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer active:scale-95"
                                        >
                                          {getStatusIcon(freq.status)}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">{freq.justificativa}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <button
                                    onClick={() => toggleFrequencia(estudante.id, dayDate)}
                                    disabled={!canEditDate(dayDate)}
                                    className={`w-11 h-11 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${!canEditDate(dayDate) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    {getStatusIcon(freq?.status || 'presente')}
                                  </button>
                                )}

                                {freq?.status === 'faltou' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openJustificativaDialog(estudante, dateStr); }}
                                    disabled={!canEditDate(dayDate)}
                                    className={`px-2 text-[10px] text-red-500 hover:underline -mt-1 ${!canEditDate(dayDate) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    Justificar
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Justificativa */}
      <Dialog open={justificativaDialogOpen} onOpenChange={setJustificativaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Justificar Falta</DialogTitle>
            <DialogDescription>
              Adicione uma justificativa para a falta do estudante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Digite a justificativa da falta..."
              value={justificativaText}
              onChange={(e) => setJustificativaText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setJustificativaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleJustificativa}>
                Salvar Justificativa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}