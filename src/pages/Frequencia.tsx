import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Calendar, CheckCircle, XCircle, FileText, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

const DIAS_SEMANA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

export default function Frequencia() {
  const navigate = useNavigate();
  const { turmaId } = useParams();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [frequencias, setFrequencias] = useState<Record<string, FrequenciaRecord>>({});
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  
  // Estado para o modal de justificativa
  const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
  const [justificativaText, setJustificativaText] = useState('');
  const [frequenciaParaJustificar, setFrequenciaParaJustificar] = useState<FrequenciaRecord | null>(null);

  useEffect(() => {
    if (turmaId) {
      loadData();
    }
  }, [turmaId, currentMonth]);

  async function loadData() {
    if (!turmaId) return;
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
      const estudantesQuery = query(collection(db, 'estudantes'), where('turma_id', '==', turmaId), orderBy('nome'));
      const querySnapshot = await getDocs(estudantesQuery);
      setEstudantes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante)));

      // Carrega as frequências para o mês atual e o ano da turma
      const startDate = startOfMonth(new Date(anoTurma, currentMonth));
      const endDate = endOfMonth(new Date(anoTurma, currentMonth));
      
      // Carregar dias letivos
      const diasLetivosQuery = query(
        collection(db, 'dias_letivos'),
        where('data', '>=', format(startDate, 'yyyy-MM-dd')),
        where('data', '<=', format(endDate, 'yyyy-MM-dd'))
      );
      const diasLetivosSnapshot = await getDocs(diasLetivosQuery);
      const diasLetivosSet = new Set<string>();
      diasLetivosSnapshot.forEach(doc => {
        diasLetivosSet.add(doc.data().data);
      });
      setDiasLetivos(diasLetivosSet);

      const freqQuery = query(
        collection(db, 'frequencias'),
        where('turma_id', '==', turmaId),
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

    } catch (error) {
      toast.error("Erro ao carregar dados da frequência");
      console.error(error);
    } finally {
      setLoading(false);
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

    const key = `${estudanteId}-${dateStr}`;
    const existingFreq = frequencias[key];

    // Calcula o novo status: presente -> faltou -> presente
    const newStatus = existingFreq?.status === 'faltou' ? 'presente' : 'faltou';

    try {
      if (existingFreq) {
        const freqRef = doc(db, 'frequencias', existingFreq.id!);
        await updateDoc(freqRef, { status: newStatus });
      } else {
        await addDoc(collection(db, 'frequencias'), {
          estudante_id: estudanteId,
          turma_id: turmaId,
          data: dateStr,
          status: newStatus,
        });
      }
      
      await logActivity(`registrou a frequência para o dia ${dateStr} na turma "${turma?.nome}".`);
      // Atualizar estado local para feedback imediato
      setFrequencias(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          estudante_id: estudanteId,
          turma_id: turmaId,
          data: dateStr,
          status: newStatus
        }
      }));

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
          data: frequenciaParaJustificar.data,
          status: 'justificado',
          justificativa: justificativaText,
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
    const key = `${estudante.id}-${date}`;
    const existingFreq = frequencias[key];
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
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Controle de frequência dos Estudantes - Ano {turma?.ano}</p>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Turmas
          </Button>

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

        <div className="bg-card border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Frequência - {MESES[currentMonth]} de {turma?.ano}</h2>
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
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 min-w-[200px]">Estudante</th>
                    {schoolDays.map((dayObj) => {
                      const isToday = isSameDay(dayObj.date, new Date());
                      const dateStr = format(dayObj.date, 'yyyy-MM-dd');
                      const isDiaLetivo = diasLetivos.has(dateStr);
                      
                      return (
                        <th 
                          key={dayObj.date.toISOString()} 
                          className={`p-2 text-center min-w-[50px] ${isToday ? 'bg-blue-100/50 border-x border-blue-200' : ''} ${!isDiaLetivo ? 'bg-gray-100 opacity-50' : ''}`}
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
                    <tr key={estudante.id}>
                      <td className="p-3 border-r">{estudante.nome}</td>
                      {schoolDays.map(({ date: dayDate }) => {
                        const dateStr = format(dayDate, 'yyyy-MM-dd');
                        const key = `${estudante.id}-${dateStr}`;
                        const freq = frequencias[key];
                        const isToday = isSameDay(dayDate, new Date());
                        const isDiaLetivo = diasLetivos.has(dateStr);
                        
                        return (
                          <td 
                            key={dayDate.toISOString()} 
                            className={`p-2 text-center ${isToday ? 'bg-blue-50/50 border-x border-blue-100' : ''} ${!isDiaLetivo ? 'bg-gray-50' : ''}`}
                          >
                            <div className="flex flex-col items-center">
                              {freq?.status === 'justificado' && freq.justificativa ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => toggleFrequencia(estudante.id, dayDate)}
                                        className={`transition-transform ${isDiaLetivo ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-30'}`}
                                        disabled={!isDiaLetivo}
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
                                  className={`transition-transform ${isDiaLetivo ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-30'}`}
                                  disabled={!isDiaLetivo}
                                  title={!isDiaLetivo ? "Dia não letivo" : ""}
                                >
                                  {getStatusIcon(freq?.status || (isDiaLetivo ? 'presente' : undefined))}
                                </button>
                              )}
                              
                              {freq?.status === 'faltou' && isDiaLetivo && (
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