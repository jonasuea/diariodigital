import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, getDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { List, User, Clock, Users, Calendar, BookOpen, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  user_name: string;
  action: string;
  created_at: Timestamp;
}

interface Evento {
  id: string;
  titulo: string;
  data: Timestamp;
  tipo: string;
}

interface DashboardStats {
  totalEstudantes: number;
  totalTurmas: number;
  totalEventos: number;
  totalProfessores: number;
  mediaNotas: number | null;
}

interface FrequenciaData {
  dia: string;
  presencas: number;
}

const DIAS_SEMANA_CHART = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function StatCard({ title, value, icon: Icon, onClick }: { title: string, value: string | number, icon: React.ElementType, onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={cn(onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : '')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Painel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalEstudantes: 0,
    totalTurmas: 0,
    totalEventos: 0,
    totalProfessores: 0,
    mediaNotas: null,
  });
  const [proximosEventos, setProximosEventos] = useState<Evento[]>([]);
  const [frequenciaData, setFrequenciaData] = useState<FrequenciaData[]>([]);
  const [atividadesRecentes, setAtividadesRecentes] = useState<ActivityLog[]>([]);
  const [periodoFrequencia, setPeriodoFrequencia] = useState('semana');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      try {
        await Promise.all([
          fetchStatsAndEvents(),
          fetchFrequenciaData(periodoFrequencia),
          fetchAtividadesRecentes()
        ]);
      } catch (error) {
        console.error("Erro ao carregar dados do painel:", error);
        toast.error("Não foi possível carregar todos os dados do painel.");
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchFrequenciaData(periodoFrequencia);
  }, [periodoFrequencia]);

  async function fetchStatsAndEvents() {
    try {
      const hojeDate = new Date();
      hojeDate.setHours(0, 0, 0, 0);
      const hojeStr = format(hojeDate, 'yyyy-MM-dd');

      const [estudantesSnap, turmasSnap, profsSnap, notasRes, eventosTimestampRes, eventosStringRes] = await Promise.all([
        getCountFromServer(collection(db, 'estudantes')),
        getCountFromServer(collection(db, 'turmas')),
        getCountFromServer(collection(db, 'professores')),
        getDocs(collection(db, 'notas')),
        getDocs(query(collection(db, 'eventos'), where('data', '>=', hojeDate), orderBy('data', 'asc'))),
        getDocs(query(collection(db, 'eventos'), where('data', '>=', hojeStr), orderBy('data', 'asc')))
      ]);

      const eventosMap = new Map<string, Evento>();

      eventosTimestampRes.docs.forEach(doc => {
        eventosMap.set(doc.id, { id: doc.id, ...doc.data() } as Evento);
      });

      eventosStringRes.docs.forEach(doc => {
        if (!eventosMap.has(doc.id)) {
          const data = doc.data();
          const timestamp = Timestamp.fromDate(parseISO(data.data as string));
          eventosMap.set(doc.id, { ...data, id: doc.id, data: timestamp } as Evento);
        }
      });

      const eventosData = Array.from(eventosMap.values())
        .sort((a, b) => a.data.toMillis() - b.data.toMillis())
        .slice(0, 5);
      
      let mediaNotas: number | null = null;
      const notasData = notasRes.docs.map(doc => doc.data());
      if (notasData.length > 0) {
        const notasValidas = notasData.filter(n => n.media_anual != null && typeof n.media_anual === 'number');
        if (notasValidas.length > 0) {
          const soma = notasValidas.reduce((acc, n) => acc + (n.media_anual || 0), 0);
          mediaNotas = Math.round((soma / notasValidas.length) * 10) / 10;
        }
      }

      setStats({
        totalEstudantes: estudantesSnap.data().count,
        totalTurmas: turmasSnap.data().count,
        totalProfessores: profsSnap.data().count,
        totalEventos: eventosData.length,
        mediaNotas,
      });

      setProximosEventos(eventosData);
    } catch (error) {
      console.error('Error fetching stats and events:', error);
      toast.error("Erro ao carregar estatísticas e eventos.");
    }
  }

  async function fetchFrequenciaData(periodo: string) {
    try {
      const hoje = new Date();
      let dataInicio: Date;
      let dataFim: Date = hoje;

      if (periodo === 'mes') {
        dataInicio = startOfMonth(hoje);
      } else { // semana
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 }); // Monday
      }

      const q = query(
        collection(db, 'frequencias'), 
        where('data', '>=', format(dataInicio, 'yyyy-MM-dd')), 
        where('data', '<=', format(dataFim, 'yyyy-MM-dd'))
      );

      const querySnapshot = await getDocs(q);
      const frequencias = querySnapshot.docs.map(doc => doc.data());

      const diasAgrupados: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      frequencias.forEach(f => {
        if (f.status === 'presente') {
          const diaSemana = getDay(parseISO(f.data));
          diasAgrupados[diaSemana]++;
        }
      });

      const dadosGrafico: FrequenciaData[] = [1, 2, 3, 4, 5].map(dia => ({
        dia: DIAS_SEMANA_CHART[dia],
        presencas: diasAgrupados[dia] || 0,
      }));

      setFrequenciaData(dadosGrafico);
    } catch (error) {
      console.error('Error fetching frequency data:', error);
      toast.error("Erro ao carregar dados de frequência.");
    }
  }

  async function fetchAtividadesRecentes() {
    try {
      const q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const activitiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
      setAtividadesRecentes(activitiesData);
    } catch (error) {
      console.error("Erro ao buscar atividades recentes:", error);
      toast.error("Não foi possível carregar o log de atividades.");
    }
  }

  const getEventTypeVariant = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'feriado': return 'bg-red-100 text-red-800 border border-red-200';
      case 'prova': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'reuniao': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'evento escolar': return 'bg-green-100 text-green-800 border border-green-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <AppLayout title="Painel">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Painel</h1>
          <p className="text-muted-foreground">Visão geral do sistema escolar.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de Estudantes" value={loading ? '...' : stats.totalEstudantes} icon={Users} onClick={() => navigate('/estudantes')} />
          <StatCard title="Total de Professores" value={loading ? '...' : stats.totalProfessores} icon={Users} onClick={() => navigate('/professores')} />
          <StatCard title="Total de Turmas" value={loading ? '...' : stats.totalTurmas} icon={BookOpen} onClick={() => navigate('/turmas')} />
          <StatCard title="Média Geral de Notas" value={loading ? '...' : stats.mediaNotas?.toFixed(1) || 'N/A'} icon={Trophy} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Frequência Geral</CardTitle>
                <CardDescription>Total de presenças por dia.</CardDescription>
              </div>
              <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Esta Semana</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="h-[300px] pr-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={frequenciaData}>
                  <XAxis dataKey="dia" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar dataKey="presencas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximos Eventos
              </CardTitle>
              <CardDescription>
                Os próximos 5 eventos no calendário escolar.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] overflow-y-auto pr-4">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando eventos...</p>
              ) : (
                <div className="space-y-4">
                  {proximosEventos.length > 0 ? (
                    proximosEventos.map(evento => (
                      <div key={evento.id} className="flex items-start gap-4">
                        <div className="flex-shrink-0 text-center font-semibold bg-muted p-2 rounded-md w-14">
                          <div className="text-xs uppercase text-red-600">{format(evento.data.toDate(), 'MMM', { locale: ptBR })}</div>
                          <div className="text-xl">{format(evento.data.toDate(), 'dd')}</div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold leading-tight">{evento.titulo}</p>
                          <p className={`text-xs font-medium inline-flex items-center px-2 py-0.5 rounded-full mt-1 ${getEventTypeVariant(evento.tipo)}`}>
                            {evento.tipo}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento futuro encontrado.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Atividades Recentes
            </CardTitle>
            <CardDescription>
              Log das últimas interações no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando atividades...</p>
            ) : (
              <div className="space-y-4">
                {atividadesRecentes.length > 0 ? (
                  atividadesRecentes.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 pt-1">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{activity.user_name || 'Usuário do Sistema'}</span> {activity.action}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {activity.created_at ? formatDistanceToNow(activity.created_at.toDate(), { addSuffix: true, locale: ptBR }) : 'agora mesmo'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma atividade registrada ainda.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}