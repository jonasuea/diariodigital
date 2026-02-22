import { useEffect, useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, School, Calendar, Trophy, UserCircle, FileText, ChevronRight, BookOpen } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer, Query } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, getDay, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';

interface DashboardStats {
  totalestudantes: number;
  totalTurmas: number;
  totalEventos: number;
  mediaNotas: number | null;
}

interface Evento {
  id: string;
  titulo: string;
  data: string;
  tipo: string;
}

interface FrequenciaData {
  dia: string;
  presencas: number;
}

interface AtividadeRecente {
  id: string;
  tipo: 'presenca' | 'nota' | 'evento' | 'estudante' | 'professor' | 'turma';
  descricao: string;
  tempo: string;
  created_at: string;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Painel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const [stats, setStats] = useState<DashboardStats>({
    totalestudantes: 0,
    totalTurmas: 0,
    totalEventos: 0,
    mediaNotas: null,
  });
  const [proximosEventos, setProximosEventos] = useState<Evento[]>([]);
  const [frequenciaData, setFrequenciaData] = useState<FrequenciaData[]>([]);
  const [atividadesRecentes, setAtividadesRecentes] = useState<AtividadeRecente[]>([]);
  const [periodoFrequencia, setPeriodoFrequencia] = useState('mes');
  const [loading, setLoading] = useState(true);

  const canViewRecentActivities = role === 'admin' || role === 'gestor';

  useEffect(() => {
    if (user && role) {
      fetchData();
      if (canViewRecentActivities) {
        fetchAtividadesRecentes();
      }
    }
  }, [user, role, canViewRecentActivities]);

  useEffect(() => {
    fetchFrequenciaData();
  }, [periodoFrequencia]);

  async function fetchData() {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      // Fetch stats (remains the same)
      const [estudantesSnap, turmasSnap, notasRes] = await Promise.all([
        getCountFromServer(collection(db, 'estudantes')),
        getCountFromServer(collection(db, 'turmas')),
        getDocs(collection(db, 'notas')),
      ]);

      // Eventos Query Logic - Refactored to filter on the client
      const eventosQuery = query(
        collection(db, 'eventos'),
        where('data', '>=', hoje),
        orderBy('data')
      );
      const proximosRes = await getDocs(eventosQuery);
      const todosEventos = proximosRes.docs.map(doc => ({ id: doc.id, ...doc.data() as { creator_id?: string } } as Evento & { creator_id?: string }));

      const eventosFiltrados = todosEventos;
      
      
      // Calculate average notes
      let mediaNotas: number | null = null;
      const notasData = notasRes.docs.map(doc => doc.data());
      if (notasData.length > 0) {
        const notasValidas = notasData.filter(n => n.media_anual != null);
        if (notasValidas.length > 0) {
          const soma = notasValidas.reduce((acc, n) => acc + (n.media_anual || 0), 0);
          mediaNotas = Math.round((soma / notasValidas.length) * 10) / 10;
        }
      }

      setStats({
        totalestudantes: estudantesSnap.data().count,
        totalTurmas: turmasSnap.data().count,
        totalEventos: eventosFiltrados.length,
        mediaNotas,
      });

      setProximosEventos(eventosFiltrados.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAtividadesRecentes() {
    // ... (rest of the function is unchanged)
    try {
      const atividades: AtividadeRecente[] = [];
      const now = new Date();

      const collectionsToFetch = ['frequencia', 'notas', 'eventos', 'Estudantes'];
      
      const promises = collectionsToFetch.map(async (coll) => {
        const q = query(collection(db, coll), orderBy('created_at', 'desc'), limit(5));
        return getDocs(q);
      });

      const snapshots = await Promise.all(promises);

      // Process Frequencias
      snapshots[0].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `freq-${doc.id}`,
            tipo: 'presenca',
            descricao: `Presença registrada`,
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });
      
      snapshots[1].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `nota-${doc.id}`,
            tipo: 'nota',
            descricao: `Notas registradas para ${data.disciplina}`,
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });
      
      snapshots[2].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `evento-${doc.id}`,
            tipo: 'evento',
            descricao: `Evento "${data.titulo}" foi adicionado`,
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });
      
      snapshots[3].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `estudante-${doc.id}`,
            tipo: 'estudante',
            descricao: `Estudante ${data.nome} foi cadastrado`,
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });

      atividades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAtividadesRecentes(atividades.slice(0, 6));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  }

  async function fetchFrequenciaData() {
    try {
      const hoje = new Date();
      let dataInicio: Date;
      let dataFim: Date = hoje;

      if (periodoFrequencia === 'mes') {
        dataInicio = startOfMonth(hoje);
      } else {
        dataInicio = new Date(hoje);
        dataInicio.setDate(dataInicio.getDate() - 7);
      }

      const q = query(
        collection(db, 'frequencia'), 
        where('data', '>=', dataInicio), 
        where('data', '<=', dataFim)
      );

      const querySnapshot = await getDocs(q);
      const frequencias = querySnapshot.docs.map(doc => doc.data());

      const diasAgrupados: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      if (frequencias) {
        frequencias.forEach(f => {
          if (f.status === 'presente') {
            const diaSemana = getDay(f.data.toDate());
            diasAgrupados[diaSemana]++;
          }
        });
      }

      const dadosGrafico: FrequenciaData[] = [1, 2, 3, 4, 5].map(dia => ({
        dia: DIAS_SEMANA[dia],
        presencas: diasAgrupados[dia],
      }));

      setFrequenciaData(dadosGrafico);
    } catch (error) {
      console.error('Error fetching frequency data:', error);
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'reunião': return 'bg-blue-100 text-blue-600';
      case 'avaliação': return 'bg-amber-100 text-amber-600';
      case 'feriado': return 'bg-green-100 text-green-600';
      case 'festa': return 'bg-pink-100 text-pink-600';
      default: return 'bg-purple-100 text-purple-600';
    }
  };

  const getAtividadeIcon = (tipo: string) => {
    switch (tipo) {
      case 'presenca': return <UserCircle className="h-5 w-5" />;
      case 'nota': return <FileText className="h-5 w-5" />;
      case 'evento': return <Calendar className="h-5 w-5" />;
      case 'estudante': return <Users className="h-5 w-5" />;
      case 'professor': return <BookOpen className="h-5 w-5" />;
      case 'turma': return <School className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getAtividadeColor = (tipo: string) => {
    switch (tipo) {
      case 'presenca': return 'bg-blue-100 text-blue-600';
      case 'nota': return 'bg-purple-100 text-purple-600';
      case 'evento': return 'bg-amber-100 text-amber-600';
      case 'estudante': return 'bg-green-100 text-green-600';
      case 'professor': return 'bg-indigo-100 text-indigo-600';
      case 'turma': return 'bg-pink-100 text-pink-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Bem-vindo à secretaria digital</p>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cards */}
        </div>

        {/* Charts and Events Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Frequência */}
          <Card className="lg:col-span-2">
            {/* ... */}
          </Card>

          {/* Próximos Eventos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : proximosEventos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum evento futuro
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {proximosEventos.map((evento) => (
                    <div key={evento.id} className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTipoIcon(evento.tipo)}`}>
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{evento.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInTimeZone(evento.data, 'America/Sao_Paulo', "d MMM, yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Atividades Recentes */}
        {canViewRecentActivities && (
          <Card>
            {/* ... */}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
