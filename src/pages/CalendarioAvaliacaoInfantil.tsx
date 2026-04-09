import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from 'date-fns';
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from 'react-i18next';
import { ptBR, enUS, es } from 'date-fns/locale';

interface Turma {
  id: string;
  nome: string;
}

export default function CalendarioAvaliacaoInfantil() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const { escolaAtivaId } = useUserRole();
  const { t, i18n } = useTranslation();

  const locales: Record<string, any> = {
    'pt-BR': ptBR,
    'en': enUS,
    'es': es
  };

  const currentLocale = locales[i18n.language] || ptBR;

  interface Evento {
    id: string;
    titulo: string;
    data: Timestamp;
  }

  const [turma, setTurma] = useState<Turma | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [diasLetivos, setDiasLetivos] = useState<Set<string>>(new Set());
  const [avaliacoesDates, setAvaliacoesDates] = useState<Set<string>>(new Set());
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

        // Fetch Avaliacoes Existentes (para marcar no calendário)
        const qAvaliacoes = query(
          collection(db, 'avaliacoes_infantil'),
          where('turma_id', '==', turmaId)
        );
        const queryAvaliacoes = await getDocs(qAvaliacoes);
        const avalDates = new Set<string>();
        queryAvaliacoes.forEach(doc => {
          const dataAval = doc.data().data_avaliacao;
          if (dataAval) avalDates.add(dataAval);
        });
        setAvaliacoesDates(avalDates);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error(t('assessments.errorLoading'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [turmaId, escolaAtivaId, t]);

  const handleConfirm = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/diario-digital/avaliacao-infantil/${turmaId}?data=${dateStr}`);
  };

  const eventDates = eventos.map(e => e.data.toDate());
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{t('assessments.title')}</h1>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              Selecione a data para registrar a avaliação da turma <span className="font-semibold text-primary">{turma?.nome}</span> Educação Infantil.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/diario-digital')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden xs:inline">{t('assessments.backToDiary')}</span>
            <span className="xs:hidden">{t('common.back')}</span>
          </Button>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-2xl">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">{t('assessments.calendarTitle')}</CardTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded-full border border-green-300"></div>
                  <span>{t('assessments.schoolDay')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-100 rounded-full border border-purple-300"></div>
                  <span>{t('assessments.assessment')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary/10 rounded-full"></div>
                  <span>{t('assessments.event')}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <div className="flex justify-center py-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        handleConfirm(date);
                      }
                    }}
                    locale={currentLocale}
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
