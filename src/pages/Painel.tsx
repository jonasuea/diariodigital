import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  BookOpen,
  Calendar,
  Trophy,
  List,
  User,
  Clock,
} from 'lucide-react';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, formatDistanceToNow, getDay, parseISO, startOfMonth, startOfWeek, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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
  taxaFaltas: number;
}

interface NotasBimestraisData {
  bimestre: string;
  media: number;
}

const DIAS_SEMANA_CHART = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function StatCard({ title, value, icon: Icon, onClick }: { title: string, value: string | number, icon: React.ElementType, onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={cn('border-yellow-200/50 shadow-sm', onClick ? 'cursor-pointer hover:bg-yellow-50/50 transition-colors' : '')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#8B6508]">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[#D4A017]" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Painel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { escolaAtivaId, role, isAdmin, isProfessor, isEstudante, loading: roleLoading } = useUserRole();
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
      if (!escolaAtivaId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await Promise.all([
          fetchStatsAndEvents(),
          fetchFrequenciaData(periodoFrequencia),
          fetchAtividadesRecentes(),
          fetchNotasBimestraisData()
        ]);
      } catch (error) {
        console.error("Sem permissão para carregar dados do painel:", error);
        toast.error("Não foi possível carregar todos os dados do painel.");
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, [escolaAtivaId]);

  useEffect(() => {
    fetchFrequenciaData(periodoFrequencia);
  }, [periodoFrequencia, escolaAtivaId]);

  async function fetchStatsAndEvents() {
    if (!escolaAtivaId) return;
    try {
      const hojeDate = new Date();
      hojeDate.setHours(0, 0, 0, 0);
      const hojeStr = format(hojeDate, 'yyyy-MM-dd');

      const [estudantesSnap, turmasSnap, profsSnap, notasRes, eventosTimestampRes, eventosStringRes] = await Promise.all([
        getCountFromServer(query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId))),
        getCountFromServer(query(collection(db, 'turmas'), where('escola_id', '==', escolaAtivaId))),
        getCountFromServer(query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId))),
        getDocs(query(collection(db, 'notas'), where('escola_id', '==', escolaAtivaId))),
        getDocs(query(collection(db, 'eventos'), where('escola_id', '==', escolaAtivaId), where('data', '>=', hojeDate), orderBy('data', 'asc'))),
        getDocs(query(collection(db, 'eventos'), where('escola_id', '==', escolaAtivaId), where('data', '>=', hojeStr), orderBy('data', 'asc')))
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
      toast.error("Sem permissão para carregar estatísticas e eventos.");
    }
  }

  async function fetchFrequenciaData(periodo: string) {
    try {
      const hoje = new Date();
      let dataInicio: Date;
      let dataFim: Date = hoje;

      if (periodo === 'mes') {
        dataInicio = startOfMonth(hoje);
      } else if (periodo === 'ano') {
        dataInicio = subYears(hoje, 1);
      } else { // semana
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 }); // Monday
      }

      const q = query(
        collection(db, 'frequencias'),
        where('escola_id', '==', escolaAtivaId),
        where('data', '>=', format(dataInicio, 'yyyy-MM-dd')),
        where('data', '<=', format(dataFim, 'yyyy-MM-dd'))
      );

      const querySnapshot = await getDocs(q);
      const frequencias = querySnapshot.docs.map(doc => doc.data());

      // Busca o total de estudantes na escola que possuem turma para usar como denominador diário
      const estudantesSnapshot = await getDocs(query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId)));
      const totalAlunosEscola = estudantesSnapshot.docs.filter(doc => {
        const t = doc.data().turma_id;
        return t !== null && t !== undefined && t !== '';
      }).length;

      const diasAgrupados: { [key: number]: { faltas: number } } = { 0: { faltas: 0 }, 1: { faltas: 0 }, 2: { faltas: 0 }, 3: { faltas: 0 }, 4: { faltas: 0 }, 5: { faltas: 0 }, 6: { faltas: 0 } };

      frequencias.forEach(f => {
        const diaSemana = getDay(parseISO(f.data));
        if (diasAgrupados[diaSemana]) {
          if (f.status === 'faltou') {
            diasAgrupados[diaSemana].faltas++;
          }
        }
      });

      const dadosGrafico: FrequenciaData[] = [1, 2, 3, 4, 5].map(dia => {
        const faltas = diasAgrupados[dia].faltas;
        // Total base de estudantes * 1 turma (Na visão macro do painel, assume-se totalAlunosEscola como faltas totais possíveis no dia)
        // Isso é uma aproximação razoável dada a nova regra que não salva as presenças.
        const percentualFaltas = totalAlunosEscola > 0 ? Math.round((faltas / totalAlunosEscola) * 100) : 0;
        return {
          dia: DIAS_SEMANA_CHART[dia],
          taxaFaltas: percentualFaltas,
        };
      });

      setFrequenciaData(dadosGrafico);
    } catch (error) {
      console.error('Error fetching frequency data:', error);
      toast.error("Sem permissão para carregar dados de frequência.");
    }
  }

  async function fetchNotasBimestraisData() {
    if (!escolaAtivaId) return;
    try {
      // NOTE: Here I also added escola_id to filter the grades
      const notasSnapshot = await getDocs(query(collection(db, 'notas'), where('escola_id', '==', escolaAtivaId)));
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
      toast.error("Sem permissão para carregar dados de notas bimestrais.");
    }
  }

  async function fetchAtividadesRecentes() {
    if (isProfessor) return; // Professor não tem acesso aos logs, evita erro 403
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'), limit(4));
      } else {
        if (!escolaAtivaId) return;
        q = query(collection(db, 'activity_log'), where('escola_id', '==', escolaAtivaId), orderBy('created_at', 'desc'), limit(4));
      }
      const querySnapshot = await getDocs(q);
      const activitiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      } as ActivityLog));
      setAtividadesRecentes(activitiesData);
    } catch (error) {
      console.error("Sem permissão para buscar atividades recentes:", error);
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
      {roleLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Carregando painel...</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">


          {!isEstudante && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total de Estudantes" value={loading ? '...' : stats.totalEstudantes} icon={Users} onClick={() => navigate('/estudantes')} />
              <StatCard title="Total de Professores" value={loading ? '...' : stats.totalProfessores} icon={Users} onClick={() => navigate('/professores')} />
              <StatCard title="Total de Turmas" value={loading ? '...' : stats.totalTurmas} icon={BookOpen} onClick={() => navigate('/turmas')} />
              <StatCard title="Média Geral de Notas" value={loading ? '...' : stats.mediaNotas?.toFixed(1) || 'N/A'} icon={Trophy} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {!isEstudante && (
              <Card className="lg:col-span-2">
                <Tabs defaultValue="frequencia" onValueChange={setActiveChartTab}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 pt-6 pb-4 gap-4">
                    <TabsList className="w-full sm:w-auto">
                      <TabsTrigger value="frequencia" className="flex-1 sm:flex-none">Frequência Geral</TabsTrigger>
                      <TabsTrigger value="notas" className="flex-1 sm:flex-none">Notas Bimestrais</TabsTrigger>
                    </TabsList>
                    {activeChartTab === 'frequencia' && (
                      <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semana">Esta Semana</SelectItem>
                          <SelectItem value="mes">Este Mês</SelectItem>
                          <SelectItem value="ano">Último Ano</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <TabsContent value="frequencia">
                    <CardContent className="h-[300px] pr-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={frequenciaData}>
                          <XAxis dataKey="dia" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                          <RechartsTooltip
                            formatter={(value: number) => [`${value}%`, 'Taxa de Faltas']}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: 'var(--radius)',
                            }}
                          />
                          <Bar dataKey="taxaFaltas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
            )}

            <Card className={isEstudante ? "lg:col-span-3" : ""}>
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
                        <div key={evento.id} className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-center font-semibold bg-yellow-50 border border-yellow-100 p-2 rounded-lg min-w-[56px]">
                            <div className="text-[10px] uppercase text-red-500 font-bold">{format(evento.data.toDate(), 'MMM', { locale: ptBR })}</div>
                            <div className="text-xl text-[#8B6508]">{format(evento.data.toDate(), 'dd')}</div>
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

          {!isProfessor && !isEstudante && (
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
          )}
        </div>
      )}
    </AppLayout>
  );
}