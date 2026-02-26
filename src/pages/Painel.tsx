import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  Book,
  Calendar,
  Award,
  ArrowUp,
  Bell,
  BarChart2,
  Users2,
  CalendarCheck,
  PartyPopper,
  Plane,
} from 'lucide-react';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, formatDistanceToNow, getDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';


// Interfaces
interface ActivityLog {
  id: string;
  user_name: string;
  action: string;
  created_at: Timestamp;
  entity_type?: string;
  entity_id?: string;
}

interface Evento {
  id: string;
  titulo: string;
  data: Timestamp;
  tipo: 'reuniao' | 'evento' | 'feriado' | 'importante' | string;
}

interface DashboardStats {
  totalEstudantes: { value: number; change: string };
  totalTurmas: { value: number; change: string };
  totalEventos: { value: number; change: string };
  mediaNotas: { value: number | null; change: string };
}

interface FrequenciaData {
  dia: string;
  presentes: number;
}

// Mapeamento de ícones para eventos
const eventIcons = {
  reuniao: <Users2 className="h-5 w-5 text-blue-500" />,
  importante: <Bell className="h-5 w-5 text-yellow-500" />,
  evento: <PartyPopper className="h-5 w-5 text-purple-500" />,
  feriado: <Plane className="h-5 w-5 text-green-500" />,
  default: <CalendarCheck className="h-5 w-5 text-gray-500" />,
};

const activityIcons = {
  presenca: <CalendarCheck className="h-5 w-5 text-blue-500" />,
  notas: <BarChart2 className="h-5 w-5 text-purple-500" />,
  evento: <Calendar className="h-5 w-5 text-green-500" />,
  default: <Bell className="h-5 w-5 text-gray-500" />,
};



// Componente Principal do Painel
export default function Painel() {
    const [stats, setStats] = useState<DashboardStats>({
        totalEstudantes: { value: 0, change: '+0.0%' },
        totalTurmas: { value: 0, change: 'ativas' },
        totalEventos: { value: 0, change: '+0.0%' },
        mediaNotas: { value: 0, change: '+0.0%' },
    });
    const [proximosEventos, setProximosEventos] = useState<Evento[]>([]);
    const [frequenciaData, setFrequenciaData] = useState<FrequenciaData[]>([]);
    const [atividadesRecentes, setAtividadesRecentes] = useState<ActivityLog[]>([]);
    const [periodoFrequencia, setPeriodoFrequencia] = useState('mes');
    const [loading, setLoading] = useState(true);

    // Efeito para buscar todos os dados
    useEffect(() => {
        async function fetchAllData() {
            setLoading(true);
            try {
                await Promise.all([
                    fetchStats(),
                    fetchProximosEventos(),
                    fetchFrequenciaData(periodoFrequencia),
                    fetchAtividadesRecentes(),
                ]);
            } catch (error) {
                console.error("Erro ao carregar dados do painel:", error);
                toast.error("Não foi possível carregar os dados do painel.");
            } finally {
                setLoading(false);
            }
        }
        fetchAllData();
    }, []);

    useEffect(() => {
        fetchFrequenciaData(periodoFrequencia);
    }, [periodoFrequencia]);


    async function fetchStats() {
        try {
            const [estudantesSnap, turmasSnap] = await Promise.all([
                getCountFromServer(collection(db, 'estudantes')),
                getCountFromServer(query(collection(db, 'turmas'), where('ativa', '==', true))),
            ]);
            
            // Simulação de dados para eventos e média, pois não tenho a lógica de "change"
            setStats({
                totalEstudantes: { value: estudantesSnap.data().count, change: '+5.2%' },
                totalTurmas: { value: turmasSnap.data().count, change: 'ativas' },
                totalEventos: { value: 12, change: '+2.1%' }, // Valor fixo como no design
                mediaNotas: { value: 8.6, change: '+0.8%' }, // Valor fixo como no design
            });

        } catch (error) {
            console.error("Erro ao carregar estatísticas:", error);
            toast.error("Erro ao carregar estatísticas.");
        }
    }
    
    async function fetchProximosEventos() {
        try {
            const hoje = Timestamp.now();
            const q = query(
                collection(db, 'eventos'),
                where('data', '>=', hoje),
                orderBy('data', 'asc'),
                limit(5)
            );
            const querySnapshot = await getDocs(q);
            const eventos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evento));
            setProximosEventos(eventos);
        } catch (error) {
            console.error("Erro ao carregar próximos eventos:", error);
            toast.error("Erro ao carregar próximos eventos.");
        }
    }
    
    async function fetchFrequenciaData(periodo: string) {
        try {
            const hoje = new Date();
            const dataInicio = periodo === 'mes' ? startOfMonth(hoje) : startOfWeek(hoje, { weekStartsOn: 1 }); // Seg
            
            const q = query(
                collection(db, 'frequencias'),
                where('data', '>=', format(dataInicio, 'yyyy-MM-dd')),
                where('data', '<=', format(hoje, 'yyyy-MM-dd'))
            );
            
            const querySnapshot = await getDocs(q);
            const presencasPorDia: { [key: string]: number } = { Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0 };
            
            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status === 'presente') {
                    const diaDaSemana = getDay(parseISO(data.data)); // Domingo é 0
                    const diaLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][diaDaSemana];
                    if (presencasPorDia[diaLabel] !== undefined) {
                        presencasPorDia[diaLabel]++;
                    }
                }
            });

            const chartData = Object.entries(presencasPorDia).map(([dia, presentes]) => ({ dia, presentes, total: 100 })); // 'total' para o fundo do gráfico
            setFrequenciaData(chartData);
        } catch (error) {
            console.error(`Erro ao carregar frequência da ${periodo}:`, error);
            toast.error(`Erro ao carregar dados de frequência.`);
        }
    }
    
    async function fetchAtividadesRecentes() {
        try {
            const q = query(collection(db, 'logs'), orderBy('created_at', 'desc'), limit(5));
            const querySnapshot = await getDocs(q);
            const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
            setAtividadesRecentes(logs);
        } catch (error) {
            console.error("Erro ao carregar atividades recentes:", error);
            toast.error("Erro ao carregar atividades recentes.");
        }
    }

    const getActionText = (log: ActivityLog) => {
        // Lógica para determinar o ícone e o texto com base na ação
        if (log.action.includes('registrou presença')) return { icon: activityIcons.presenca, text: log.action };
        if (log.action.includes('registrou notas')) return { icon: activityIcons.notas, text: log.action };
        if (log.action.includes('adicionou um novo evento')) return { icon: activityIcons.evento, text: log.action };
        return { icon: activityIcons.default, text: log.action };
    }


    if (loading) {
        return <AppLayout><div>Carregando...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <main className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-background">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                        <p className="text-muted-foreground">Bem-vindo à secretaria digital</p>
                    </div>
                </div>

                {/* Cards de Estatísticas */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total de Alunos" value={stats.totalEstudantes.value} change={stats.totalEstudantes.change} icon={Users} period="este mês" />
                    <StatCard title="Total de Turmas" value={stats.totalTurmas.value} change="" icon={Book} period="ativas" />
                    <StatCard title="Eventos" value={stats.totalEventos.value} change={stats.totalEventos.change} icon={Calendar} period="próximos 30 dias" />
                    <StatCard title="Média de Notas" value={stats.mediaNotas.value ?? 'N/A'} change={stats.mediaNotas.change} icon={Award} period="último bimestre" />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    {/* Gráfico de Frequência */}
                    <Card className="col-span-12 lg:col-span-4">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Estatísticas de Frequência</CardTitle>
                                <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Período" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="semana">Esta Semana</SelectItem>
                                        <SelectItem value="mes">Este Mês</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="pl-2">
                             <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={frequenciaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                     <XAxis dataKey="dia" tickLine={false} axisLine={false} stroke="#888888" fontSize={12} />
                                     <YAxis tickLine={false} axisLine={false} stroke="#888888" fontSize={12} domain={[0, 'dataMax + 20']} />
                                     <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '5px' }}
                                    />
                                    <Bar dataKey="presentes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Próximos Eventos */}
                    <Card className="col-span-12 lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Próximos Eventos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {proximosEventos.length > 0 ? (
                                proximosEventos.map((evento) => (
                                    <div key={evento.id} className="flex items-start space-x-4">
                                         <div className="p-2 bg-gray-100 rounded-full">
                                            {eventIcons[evento.tipo] || eventIcons.default}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{evento.titulo}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(evento.data.toDate(), "dd 'de' MMM, yyyy", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Atividades Recentes */}
                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <CardTitle>Atividades Recentes</CardTitle>
                            <a href="#" className="text-sm font-medium text-blue-600 hover:underline">Ver todas</a>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                             {atividadesRecentes.length > 0 ? (
                                atividadesRecentes.map((log) => {
                                    const { icon, text } = getActionText(log);
                                    return (
                                        <div key={log.id} className="flex items-start space-x-4">
                                            <div className="p-2 bg-gray-100 rounded-full">{icon}</div>
                                            <div className="flex-1">
                                                <p className="text-sm">
                                                    <span className="font-semibold">{log.user_name}</span> {text}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                     {formatDistanceToNow(log.created_at.toDate(), { addSuffix: true, locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </AppLayout>
    );
}


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

interface NotasBimestraisData {
  bimestre: string;
  media: number;
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
  const [notasBimestraisData, setNotasBimestraisData] = useState<NotasBimestraisData[]>([]);
  const [periodoFrequencia, setPeriodoFrequencia] = useState('semana');
  const [activeChartTab, setActiveChartTab] = useState('frequencia');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      try {
        await Promise.all([
          fetchStatsAndEvents(),
          fetchFrequenciaData(periodoFrequencia),
          fetchAtividadesRecentes(),
          fetchNotasBimestraisData()
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
        let somaTotal = 0;
        let contadorTotal = 0;

        notasData.forEach(nota => {
          if (nota.bimestre_1 != null && typeof nota.bimestre_1 === 'number') {
            somaTotal += nota.bimestre_1;
            contadorTotal++;
          }
          if (nota.bimestre_2 != null && typeof nota.bimestre_2 === 'number') {
            somaTotal += nota.bimestre_2;
            contadorTotal++;
          }
          if (nota.bimestre_3 != null && typeof nota.bimestre_3 === 'number') {
            somaTotal += nota.bimestre_3;
            contadorTotal++;
          }
          if (nota.bimestre_4 != null && typeof nota.bimestre_4 === 'number') {
            somaTotal += nota.bimestre_4;
            contadorTotal++;
          }
        });

        if (contadorTotal > 0) {
          mediaNotas = Math.round((somaTotal / contadorTotal) * 10) / 10;
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

  async function fetchNotasBimestraisData() {
    try {
      const notasSnapshot = await getDocs(collection(db, 'notas'));
      const notasData = notasSnapshot.docs.map(doc => doc.data());

      const bimestres: { [key: string]: { soma: number; count: number } } = {
        '1º Bim': { soma: 0, count: 0 },
        '2º Bim': { soma: 0, count: 0 },
        '3º Bim': { soma: 0, count: 0 },
        '4º Bim': { soma: 0, count: 0 },
      };

      notasData.forEach(nota => {
        if (nota.bimestre_1 != null && typeof nota.bimestre_1 === 'number') {
          bimestres['1º Bim'].soma += nota.bimestre_1;
          bimestres['1º Bim'].count++;
        }
        if (nota.bimestre_2 != null && typeof nota.bimestre_2 === 'number') {
          bimestres['2º Bim'].soma += nota.bimestre_2;
          bimestres['2º Bim'].count++;
        }
        if (nota.bimestre_3 != null && typeof nota.bimestre_3 === 'number') {
          bimestres['3º Bim'].soma += nota.bimestre_3;
          bimestres['3º Bim'].count++;
        }
        if (nota.bimestre_4 != null && typeof nota.bimestre_4 === 'number') {
          bimestres['4º Bim'].soma += nota.bimestre_4;
          bimestres['4º Bim'].count++;
        }
      });

      const dadosGrafico: NotasBimestraisData[] = Object.entries(bimestres).map(([key, value]) => ({
        bimestre: key,
        media: value.count > 0 ? Math.round((value.soma / value.count) * 10) / 10 : 0,
      }));

      setNotasBimestraisData(dadosGrafico);
    } catch (error) {
      console.error('Error fetching bimester grades data:', error);
      toast.error("Erro ao carregar dados de notas bimestrais.");
    }
  }

  async function fetchAtividadesRecentes() {
    try {
      const q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'), limit(4));
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de Estudantes" value={loading ? '...' : stats.totalEstudantes} icon={Users} onClick={() => navigate('/estudantes')} />
          <StatCard title="Total de Professores" value={loading ? '...' : stats.totalProfessores} icon={Users} onClick={() => navigate('/professores')} />
          <StatCard title="Total de Turmas" value={loading ? '...' : stats.totalTurmas} icon={BookOpen} onClick={() => navigate('/turmas')} />
          <StatCard title="Média Geral de Notas" value={loading ? '...' : stats.mediaNotas?.toFixed(1) || 'N/A'} icon={Trophy} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <Tabs defaultValue="frequencia" onValueChange={setActiveChartTab}>
              <div className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
                <TabsList>
                  <TabsTrigger value="frequencia">Frequência Geral</TabsTrigger>
                  <TabsTrigger value="notas">Notas Bimestrais</TabsTrigger>
                </TabsList>
                {activeChartTab === 'frequencia' && (
                  <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Esta Semana</SelectItem>
                      <SelectItem value="mes">Este Mês</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <TabsContent value="frequencia">
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
              </TabsContent>
              <TabsContent value="notas">
                <CardContent className="h-[300px] pr-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={notasBimestraisData}>
                      <XAxis dataKey="bimestre" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                        }}
                      />
                      <Bar dataKey="media" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </TabsContent>
            </Tabs>
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
            <CardContent className="h-[300px] overflow-y-auto pr-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando eventos...</p>
              ) : (
                <div className="space-y-3">
                  {proximosEventos.length > 0 ? (
                    proximosEventos.map(evento => (
                      <div key={evento.id} className="flex items-start gap-2">
                        <div className="flex-shrink-0 text-center font-semibold bg-muted p-1.0 rounded-md w-5">
                          <div className="text-xs uppercase text-red-500">{format(evento.data.toDate(), 'MMM', { locale: ptBR })}</div>
                          <div className="text-lg">{format(evento.data.toDate(), 'dd')}</div>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Atividades Recentes
              </CardTitle>
              <CardDescription>
                Log das últimas interações no sistema.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/logs')}>
              Visualizar Todos
            </Button>
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