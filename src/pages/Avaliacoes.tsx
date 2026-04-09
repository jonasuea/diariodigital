import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { turmaRepo, eventosRepo, diasLetivosRepo } from '@/repositories/CadastrosRepository';
import { avaliacaoRepo } from '@/repositories/AvaliacaoRepository';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Calendar as CalendarIcon, ClipboardList } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { useUserRole } from "@/hooks/useUserRole";

interface Turma {
  id: string;
  nome: string;
}

interface Evento {
  id: string;
  titulo: string;
  data: string | { toDate: () => Date };
}

interface Avaliacao {
  id: string;
  titulo: string;
  data: string;
}

export default function Avaliacoes() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');
  const { escolaAtivaId } = useUserRole();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [avaliacoesDates, setAvaliacoesDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !componente || !escolaAtivaId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        // 1. Seed online
        if (navigator.onLine) {
          try {
            await Promise.all([
              turmaRepo.seed(escolaAtivaId),
              avaliacaoRepo.seedAvaliacoes(turmaId, escolaAtivaId),
              eventosRepo.seed(escolaAtivaId),
              diasLetivosRepo.seed(escolaAtivaId)
            ]);
          } catch (e) {
            console.warn("[Avaliacoes] Erro ao sincronizar", e);
          }
        }

        // Fetch local
        const [turmaData, queryEvents, queryDias, queryAval] = await Promise.all([
          turmaRepo.getById(turmaId),
          eventosRepo.getByEscola(escolaAtivaId),
          diasLetivosRepo.getByEscola(escolaAtivaId),
          avaliacaoRepo.getAvaliacoesByTurma(turmaId, componente)
        ]);
        
        setTurma(turmaData);

        setEventos(queryEvents.map(e => ({
          ...e,
          data: typeof e.data === 'string' ? { toDate: () => parseISO(e.data) } : e.data
        } as any)));

        setDiasLetivos(new Set(queryDias.map(d => d.data)));
        setAvaliacoesDates(new Set(queryAval.map(a => a.data)));

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error("Erro ao carregar os dados offline.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [turmaId, componente, escolaAtivaId]);

  const eventDates = eventos.map(e => {
    if (typeof e.data === 'string') return parseISO(e.data);
    if (e.data && typeof e.data.toDate === 'function') return e.data.toDate();
    return new Date();
  });
  const diasLetivosDates = Array.from(diasLetivos).map(d => {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
  const hasAvaliacaoDates = Array.from(avaliacoesDates).map(d => {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day);
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Avaliações</h1>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              Visualize e agende avaliações para a turma <span className="font-semibold text-primary">{turma?.nome}</span> no componente <span className="font-semibold text-primary">{componente}</span>.
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
              <CardTitle className="text-lg">Calendário de Avaliações</CardTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded-full border border-green-300"></div>
                  <span>Dia Letivo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-100 rounded-full border border-purple-300"></div>
                  <span>Avaliação</span>
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
                        navigate(`/diario-digital/avaliacoes/${turmaId}/registro?componente=${componente}&data=${dateStr}`);
                      }
                    }}
                    locale={ptBR}
                    className="rounded-md border shadow-sm mx-auto"
                    modifiers={{
                      hasEvent: eventDates,
                      isLetivo: diasLetivosDates,
                      hasAvaliacao: hasAvaliacaoDates,
                    }}
                    modifiersClassNames={{
                      isLetivo: 'day-letivo',
                      hasAvaliacao: 'day-avaliacao'
                    }}
                    modifiersStyles={{
                      isLetivo: { 
                        backgroundColor: '#dcfce7', 
                        color: '#166534',
                        borderRadius: '50%'
                      },
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
