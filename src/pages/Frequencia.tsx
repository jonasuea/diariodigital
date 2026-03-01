import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Calendar, CheckCircle, XCircle, FileText, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, subDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
}

interface FrequenciaRecord {
  id?: string;
  estudante_id: string;
  turma_id: string;
  data: string;
  status: 'presente' | 'faltou' | 'justificado';
  justificativa?: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  componentes?: { nome: string; professorId: string }[]; // Adicionar a lista de componentes
}

const DIAS_SEMANA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

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

  // Estado para o modal de justificativa
  const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
  const [justificativaText, setJustificativaText] = useState('');
  const [frequenciaParaJustificar, setFrequenciaParaJustificar] = useState<FrequenciaRecord | null>(null);

  // Referência para o dia atual para fazer autoscroll
  const currentDayRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (turmaId) {
      loadData();
    }
  }, [turmaId, currentMonth, componente, escolaAtivaId]);

  // Efeito para atualizar a URL quando o componente muda, preservando outros parâmetros
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
      // Carrega os dados da turma
      const turmaDocRef = doc(db, 'turmas', turmaId);
      const turmaDoc = await getDoc(turmaDocRef);
      const turmaData = turmaDoc.exists() ? { id: turmaDoc.id, ...turmaDoc.data() } as Turma : null;
      setTurma(turmaData);

      if (!turmaData) {
        toast.error("Turma não encontrada");
        setLoading(false);
        return;
      }

      // Usa o ano da turma para carregar os dados
      const anoTurma = turmaData.ano;

      // Carrega os estudantes da turma
      const estudantesQuery = query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId), where('turma_id', '==', turmaId), orderBy('nome'));
      const querySnapshot = await getDocs(estudantesQuery);
      setEstudantes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante)));

      // Carrega as frequências para o mês atual e o ano da turma
      const startDate = startOfMonth(new Date(anoTurma, currentMonth));
      const endDate = endOfMonth(new Date(anoTurma, currentMonth));

      // Carregar dias letivos
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

      // Só busca frequência se um componente estiver selecionado
      if (componente) {
        let freqQuery = query(
          collection(db, 'frequencias'),
          where('escola_id', '==', escolaAtivaId),
          where('turma_id', '==', turmaId),
          where('componente', '==', componente), // Filtro por componente
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
        setFrequencias({}); // Limpa as frequências se nenhum componente for selecionado
      }

    } catch (error) {
      toast.error("Erro ao carregar dados da frequência");
      console.error(error);
    } finally {
      setLoading(false);
      // Fazer scroll para o dia de hoje após o carregamento, se existir a referência
      setTimeout(() => {
        if (currentDayRef.current) {
          currentDayRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 500); // tempo para o render terminar
    }
  }

  // Se a turma ainda não carregou, não podemos calcular schoolDays corretamente
  const anoLetivo = turma?.ano || new Date().getFullYear();

  const schoolDays = (() => {
    try {
      const start = startOfMonth(new Date(anoLetivo, currentMonth));
      const end = endOfMonth(new Date(anoLetivo, currentMonth));

      // Validação extra para garantir datas válidas
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
      }

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

  const toggleFrequencia = async (estudanteId: string, data: Date) => {
    if (!turmaId) return;
    const dateStr = format(data, 'yyyy-MM-dd');

    // Verificar se é dia letivo
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

    // Status atual real (do banco ou implícito)
    const currentStatus = existingFreq ? existingFreq.status : (hojeOuPassado ? 'presente' : null);

    if (!currentStatus) return; // Se for dia futuro e não tiver registro, nada faz.

    // Calcula o novo status: presente -> faltou -> presente
    const newStatus = currentStatus === 'faltou' ? 'presente' : 'faltou';

    try {
      if (existingFreq) {
        if (newStatus === 'presente') {
          // Voltou a ser presente. Poderíamos apagar do banco para limpar as "presenças explícitas", mas 
          // manter como "presente" garante compatibilidade. No entanto, para não inchar o banco de dados desnecessariamente, vamos deletar o documento.
          const freqRef = doc(db, 'frequencias', existingFreq.id!);
          // Excluir ou atualizar? Deletar se voltou para presente economiza espaço e mantém a lógica de presença implícita.
          await updateDoc(freqRef, { status: newStatus });
        } else {
          const freqRef = doc(db, 'frequencias', existingFreq.id!);
          await updateDoc(freqRef, { status: newStatus });
        }
      } else {
        // Clicando na presença implícita -> Virou falta (porque novoStatus === 'faltou')
        await addDoc(collection(db, 'frequencias'), {
          estudante_id: estudanteId,
          turma_id: turmaId,
          escola_id: escolaAtivaId,
          data: dateStr,
          status: newStatus,
          componente: componente,
          ano: turma?.ano || new Date().getFullYear()
        });
      }

      await logActivity(`registrou a frequência para o dia ${dateStr} na turma "${turma?.nome}".`);
      // Recarregar dados para garantir sincronização
      loadData();

    } catch (error) {
      toast.error('Erro ao atualizar frequência');
      console.error(error);
    }
  };

  const handleJustificativa = async () => {
    if (!frequenciaParaJustificar) return;

    try {
      if (frequenciaParaJustificar.id) {
        const freqRef = doc(db, 'frequencias', frequenciaParaJustificar.id);
        await updateDoc(freqRef, { status: 'justificado', justificativa: justificativaText });
      } else {
        await addDoc(collection(db, 'frequencias'), {
          estudante_id: frequenciaParaJustificar.estudante_id,
          turma_id: turmaId!,
          escola_id: escolaAtivaId,
          data: frequenciaParaJustificar.data,
          status: 'justificado',
          justificativa: justificativaText,
          componente: componente,
          ano: turma?.ano || new Date().getFullYear()
        });
      }

      await logActivity(`justificou a falta do dia ${frequenciaParaJustificar.data} na turma "${turma?.nome}".`);
      toast.success('Falta justificada com sucesso');
      setJustificativaDialogOpen(false);
      loadData(); // Recarregar dados
    } catch (error) {
      toast.error('Erro ao salvar justificativa');
      console.error(error);
    }
  };

  const openJustificativaDialog = (estudante: Estudante, date: string) => {
    const existingFreq = frequencias[`${estudante.id}-${date}`];
    setFrequenciaParaJustificar(existingFreq || {
      estudante_id: estudante.id,
      turma_id: turmaId!,
      data: date,
      status: 'faltou'
    });
    setJustificativaText(existingFreq?.justificativa || '');
    setJustificativaDialogOpen(true);
  };

  function getStatusIcon(status: string | undefined) {
    switch (status) {
      case 'presente':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'faltou':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'justificado':
        return <FileText className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  }

  const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  return (
    <AppLayout title={`Frequência - ${turma?.nome || ''}`}>
      <div className="space-y-4 animate-fade-in w-full max-w-full overflow-hidden">
        <p className="text-muted-foreground -mt-1">Controle de frequência dos Estudantes - Ano {turma?.ano}</p>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => navigate(origem === 'diario' ? '/diario-digital' : '/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {origem === 'diario' ? 'Voltar para Diário Digital' : 'Voltar para Turmas'}
          </Button>

          <div className="flex items-center gap-2">
            <Label htmlFor="componente-select">Componente</Label>
            <Select value={componente} onValueChange={setComponente} disabled={isComponenteFixo || !turma?.componentes || turma.componentes.length === 0}>
              <SelectTrigger id="componente-select" className="w-[200px]">
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
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((mes, index) => (
                  <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2 bg-muted/30 px-3 py-1 rounded-md text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Ano Letivo: {turma?.ano}</span>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-6 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Frequência - {MESES[currentMonth]} de {turma?.ano}
              {componente && <span className="text-primary font-bold ml-2">({componente})</span>}
            </h2>
          </div>

          <div className="flex items-center gap-6 mb-4 text-sm">
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
            <div className="relative w-full max-w-full overflow-x-auto border rounded-lg pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent">
              <table className="w-full border-separate border-spacing-0" style={{ minWidth: isPrivilegedUser ? '800px' : '400px' }}>
                <thead>
                  <tr>
                    <th className="text-left p-3 min-w-[250px] max-w-[250px] sticky left-0 z-30 bg-muted/95 backdrop-blur-md border-b border-t-0 border-r shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)]">
                      Estudante
                    </th>
                    {schoolDays.filter(dayObj => {
                      const dateStr = format(dayObj.date, 'yyyy-MM-dd');
                      if (!diasLetivos.has(dateStr)) return false;

                      // Filtro de 5 dias para professores (ocultar dias mais antigos que hoje - 5)
                      if (!isPrivilegedUser) {
                        const limitePassado = startOfDay(subDays(new Date(), 5));
                        if (isBefore(dayObj.date, limitePassado)) return false;
                      }

                      return true;
                    }).map((dayObj) => {
                      const isToday = isSameDay(dayObj.date, new Date());
                      const dateStr = format(dayObj.date, 'yyyy-MM-dd');

                      return (
                        <th
                          key={dayObj.date.toISOString()}
                          ref={isToday ? currentDayRef : null}
                          className={`p-2 text-center min-w-[50px] border-b border-t-0 ${isToday ? 'bg-blue-100/50 border-x border-blue-200' : ''}`}
                        >
                          <div className={`text-xs ${isToday ? 'text-blue-700 font-bold' : 'text-muted-foreground'}`}>
                            {dayObj.dayName}
                          </div>
                          <div className={isToday ? 'text-blue-700 font-bold' : ''}>
                            {dayObj.dayStr}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {estudantes.map((estudante) => (
                    <tr key={estudante.id} className="hover:bg-gray-200 dark:hover:bg-gray-800 group transition-colors">
                      <td className="p-3 border-b border-r bg-background sticky left-0 z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)] font-medium truncate min-w-[250px] max-w-[250px] group-hover:bg-gray-200 dark:group-hover:bg-gray-800 transition-colors" title={estudante.nome}>
                        {estudante.nome}
                      </td>
                      {schoolDays.filter(dayObj => {
                        const dateStr = format(dayObj.date, 'yyyy-MM-dd');
                        if (!diasLetivos.has(dateStr)) return false;

                        // Filtro de 5 dias para professores (ocultar dias mais antigos que hoje - 5)
                        if (!isPrivilegedUser) {
                          const limitePassado = startOfDay(subDays(new Date(), 5));
                          if (isBefore(dayObj.date, limitePassado)) return false;
                        }

                        return true;
                      }).map(({ date: dayDate }) => {
                        const dateStr = format(dayDate, 'yyyy-MM-dd');
                        const key = `${estudante.id}-${dateStr}`;
                        let freq = frequencias[key];
                        const isToday = isSameDay(dayDate, new Date());

                        // Presença implícita: Se o dia já passou ou é hoje, e não tem registro no banco, assume 'presente'
                        if (!freq) {
                          const hojeOuPassado = isBefore(dayDate, new Date()) || isToday;
                          if (hojeOuPassado) {
                            freq = {
                              estudante_id: estudante.id,
                              turma_id: turmaId!,
                              data: dateStr,
                              status: 'presente'
                            };
                          }
                        }

                        return (
                          <td
                            key={dayDate.toISOString()}
                            className={`p-2 text-center border-b ${isToday ? 'bg-blue-50/50 border-x border-blue-100' : ''}`}
                          >
                            <div className="flex flex-col items-center">
                              {freq?.status === 'justificado' && freq.justificativa ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => toggleFrequencia(estudante.id, dayDate)}
                                        className="transition-transform hover:scale-110 cursor-pointer"
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
                                  className="transition-transform hover:scale-110 cursor-pointer"
                                  title=""
                                >
                                  {getStatusIcon(freq?.status || 'presente')}
                                </button>
                              )}

                              {freq?.status === 'faltou' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openJustificativaDialog(estudante, format(dayDate, 'yyyy-MM-dd')); }}
                                  className="text-xs text-red-500 cursor-pointer hover:underline"
                                >
                                  Justificar
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
      </div>
    </AppLayout>
  );
}