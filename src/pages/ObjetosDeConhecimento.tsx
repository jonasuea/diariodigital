import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from 'date-fns/locale';
import { format, isSameDay, parseISO } from 'date-fns';
import { useUserRole } from "@/hooks/useUserRole";

interface Turma {
  id: string;
  nome: string;
}

interface Evento {
  id: string;
  titulo: string;
  data: Timestamp;
}

export default function ObjetosDeConhecimento() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');
  const { escolaAtivaId } = useUserRole();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [diasMinistrados, setDiasMinistrados] = useState<Set<string>>(new Set());
  const [diasNaoMinistrados, setDiasNaoMinistrados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !escolaAtivaId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        // Fetch Turma
        const turmaDocRef = doc(db, 'turmas', turmaId);
        const turmaDoc = await getDoc(turmaDocRef);
        if (turmaDoc.exists()) {
          setTurma({ id: turmaDoc.id, ...turmaDoc.data() } as Turma);
        }

        // Fetch Eventos
        const qEventos = query(
          collection(db, 'eventos'),
          where('escola_id', '==', escolaAtivaId),
          orderBy('data', 'asc')
        );
        const queryEvents = await getDocs(qEventos);
        const eventosData = queryEvents.docs.map(doc => {
          const data = doc.data();
          if (data.data && typeof data.data === 'string') {
            data.data = Timestamp.fromDate(parseISO(data.data));
          }
          return { id: doc.id, ...data } as Evento;
        });
        setEventos(eventosData);

        // Fetch Dias Letivos
        const qDias = query(
          collection(db, 'dias_letivos'),
          where('escola_id', '==', escolaAtivaId)
        );
        const queryDias = await getDocs(qDias);
        const dias = new Set<string>();
        queryDias.forEach(doc => {
          dias.add(doc.data().data);
        });
        setDiasLetivos(dias);

        // Fetch Dias Planejados (registros de aulas)
        // For Early Childhood (no componente), query only by turma_id
        const qPlanejados = componente
          ? query(
              collection(db, 'registros_aulas'),
              where('turma_id', '==', turmaId),
              where('componente', '==', componente)
            )
          : query(
              collection(db, 'registros_aulas'),
              where('turma_id', '==', turmaId)
            );
        const queryPlanejados = await getDocs(qPlanejados);
        const ministrados = new Set<string>();
        const naoMinistrados = new Set<string>();

        queryPlanejados.forEach(doc => {
          const data = doc.data();
          if (data.status === 'Ministrado') {
            ministrados.add(data.data);
          } else {
            naoMinistrados.add(data.data);
          }
        });
        setDiasMinistrados(ministrados);
        setDiasNaoMinistrados(naoMinistrados);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error("Erro ao carregar os dados do calendário.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [turmaId, componente, escolaAtivaId]);

  const eventDates = eventos.map(e => e.data.toDate());
  const diasLetivosDates = Array.from(diasLetivos).map(d => parseISO(d));
  const diasMinistradosDates = Array.from(diasMinistrados).map(d => parseISO(d));
  const diasNaoMinistradosDates = Array.from(diasNaoMinistrados).map(d => parseISO(d));

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Objetos de Conhecimento</h1>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              Visualize os dias letivos e eventos para a turma <span className="font-semibold text-primary">{turma?.nome}</span>{componente ? <> no componente <span className="font-semibold text-primary">{componente}</span></> : null}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/diario-digital')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden xs:inline">Voltar para o Diário</span>
            <span className="xs:hidden">Voltar</span>
          </Button>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-2xl">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Calendário Planos de Aula</CardTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded-full border border-green-300"></div>
                  <span>Dia Letivo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-100 rounded-full border border-blue-300"></div>
                  <span>Ministrado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-100 rounded-full border border-red-300"></div>
                  <span>Não Ministrado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary/10 rounded-full"></div>
                  <span>Evento</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="flex justify-center py-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const compParam = componente ? `&componente=${componente}` : '';
                        navigate(`/diario-digital/objetos-de-conhecimento/${turmaId}/registro?data=${dateStr}${compParam}`);
                      }
                    }}
                    locale={ptBR}
                    className="rounded-md border shadow-sm mx-auto"
                    modifiers={{
                      hasEvent: eventDates,
                      isLetivo: diasLetivosDates,
                      isMinistrado: diasMinistradosDates,
                      isNaoMinistrado: diasNaoMinistradosDates
                    }}
                    modifiersClassNames={{
                      isLetivo: 'day-letivo',
                      isMinistrado: 'day-planejado',
                      isNaoMinistrado: 'day-nao-ministrado'
                    }}
                    modifiersStyles={{
                      hasEvent: {
                        fontWeight: 'bold',
                        textDecoration: 'underline',
                        textDecorationColor: 'hsl(var(--primary))',
                      }
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}