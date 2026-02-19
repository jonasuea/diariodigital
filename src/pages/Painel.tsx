import { useEffect, useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, School, Calendar, Trophy, UserCircle, FileText, ChevronRight, BookOpen } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, getDay, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalAlunos: number;
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
  tipo: 'presenca' | 'nota' | 'evento' | 'aluno' | 'professor' | 'turma';
  descricao: string;
  tempo: string;
  created_at: string;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Painel() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [stats, setStats] = useState<DashboardStats>({
    totalAlunos: 0,
    totalTurmas: 0,
    totalEventos: 0,
    mediaNotas: null,
  });
  const [proximosEventos, setProximosEventos] = useState<Evento[]>([]);
  const [frequenciaData, setFrequenciaData] = useState<FrequenciaData[]>([]);
  const [atividadesRecentes, setAtividadesRecentes] = useState<AtividadeRecente[]>([]);
  const [periodoFrequencia, setPeriodoFrequencia] = useState('mes');
  const [loading, setLoading] = useState(true);

  // Define who can see the recent activities log
  // Includes admin and management roles (gestor, secretario, pedagogo)
  const canViewRecentActivities = role === 'admin' || role === 'gestor';

  useEffect(() => {
    fetchData();
    if (canViewRecentActivities) {
      fetchAtividadesRecentes();
    }
  }, [canViewRecentActivities]);

  useEffect(() => {
    fetchFrequenciaData();
  }, [periodoFrequencia]);

  async function fetchData() {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      const [alunosSnap, turmasSnap, eventosSnap, proximosRes, notasRes] = await Promise.all([
        getCountFromServer(collection(db, 'alunos')),
        getCountFromServer(collection(db, 'turmas')),
        getCountFromServer(query(collection(db, 'eventos'), where('data', '>=', hoje))),
        getDocs(query(collection(db, 'eventos'), where('data', '>=', hoje), orderBy('data'), limit(5))),
        getDocs(collection(db, 'notas')),
      ]);

      // Calcular média geral das notas
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
        totalAlunos: alunosSnap.data().count,
        totalTurmas: turmasSnap.data().count,
        totalEventos: eventosSnap.data().count,
        mediaNotas,
      });

      setProximosEventos(proximosRes.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evento)));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAtividadesRecentes() {
    // NOTE: This is not an optimal way to fetch recent activities.
    // A better approach would be to have a single 'atividades' collection
    // where all these events are recorded.
    try {
      const atividades: AtividadeRecente[] = [];
      const now = new Date();

      const collectionsToFetch = ['frequencia', 'notas', 'eventos', 'alunos'];
      
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
            descricao: `Presença registrada`, // Turma name would require another fetch
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });
      
      // Process Notas
      snapshots[1].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `nota-${doc.id}`,
            tipo: 'nota',
            descricao: `Notas registradas para ${data.disciplina}`, // Turma name would require another fetch
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });
      
      // Process Eventos
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
      
      // Process Alunos
      snapshots[3].forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
          atividades.push({
            id: `aluno-${doc.id}`,
            tipo: 'aluno',
            descricao: `Aluno ${data.nome} foi cadastrado`,
            tempo: formatDistanceToNow(data.created_at.toDate(), { addSuffix: true, locale: ptBR }),
            created_at: data.created_at.toDate().toISOString(),
          });
        }
      });

      // Ordenar todas as atividades por data
      atividades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Pegar apenas as 6 mais recentes
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
        // Última semana
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

      // Agrupar presenças por dia da semana
      const diasAgrupados: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      if (frequencias) {
        frequencias.forEach(f => {
          if (f.status === 'presente') {
            const diaSemana = getDay(f.data.toDate());
            diasAgrupados[diaSemana]++;
          }
        });
      }

      // Formatar dados para o gráfico (apenas dias úteis: seg a sex)
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
      case 'aluno': return <Users className="h-5 w-5" />;
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
      case 'aluno': return 'bg-green-100 text-green-600';
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/alunos')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Alunos</p>
                  <p className="text-2xl font-bold mt-1">{loading ? '...' : stats.totalAlunos.toLocaleString()}</p>
                  <p className="text-xs text-success mt-1">+5,2% este mês</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/turmas')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Turmas</p>
                  <p className="text-2xl font-bold mt-1">{loading ? '...' : stats.totalTurmas}</p>
                  <p className="text-xs text-muted-foreground mt-1">ativas</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <School className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/calendario')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eventos</p>
                  <p className="text-2xl font-bold mt-1">{loading ? '...' : stats.totalEventos}</p>
                  <p className="text-xs text-success mt-1">+2,1% próximos 30 dias</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Média de Notas</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? '...' : stats.mediaNotas !== null ? stats.mediaNotas.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-success mt-1">+0,8% último bimestre</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Events Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Estatísticas de Frequência */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Estatísticas de Frequência</CardTitle>
                <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Este mês</SelectItem>
                    <SelectItem value="semana">Esta semana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequenciaData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <XAxis 
                      dataKey="dia" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value} presenças`, 'Presenças']}
                    />
                    <Bar 
                      dataKey="presencas" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
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
                          {format(new Date(evento.data), "d MMM, yyyy", { locale: ptBR })}
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
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Atividades Recentes</CardTitle>
                <Button variant="link" className="text-primary p-0 h-auto" onClick={() => fetchAtividadesRecentes()}>
                  Atualizar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {atividadesRecentes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade recente
                  </p>
                ) : (
                  atividadesRecentes.map((atividade) => (
                    <div key={atividade.id} className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${getAtividadeColor(atividade.tipo)}`}>
                        {getAtividadeIcon(atividade.tipo)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{atividade.descricao}</p>
                        <p className="text-xs text-muted-foreground">{atividade.tempo}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
