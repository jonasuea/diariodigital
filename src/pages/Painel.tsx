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
  GraduationCap,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import {
  collection,
  getCountFromServer,
  getDocs,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  format,
  formatDistanceToNow,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn, safeToDate } from '@/lib/utils';
import { localDb } from '@/lib/db';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface DashboardAlert {
  id: string;
  tipo: 'warning' | 'success' | 'info';
  titulo: string;
  descricao: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIAS_SEMANA_CHART = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-28 bg-muted rounded-md" />
        <div className="h-9 w-9 bg-muted rounded-lg" />
      </div>
      <div className="h-8 w-20 bg-muted rounded-md" />
      <div className="h-3 w-16 bg-muted rounded-md" />
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

function KPICard({ title, value, icon: Icon, gradient, iconBg, trend, onClick }: KPICardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'relative overflow-hidden border-0 shadow-soft transition-all duration-200',
        'hover:shadow-soft-lg hover:-translate-y-0.5',
        onClick && 'cursor-pointer'
      )}
    >
      {/* gradient accent strip */}
      <div className={cn('absolute inset-x-0 top-0 h-1 rounded-t-xl', gradient)} />

      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight tabular-nums leading-none">
              {value}
            </p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend && (
          <div className="mt-3 flex items-center gap-1.5">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const icons = {
    warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
    info: <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
  };
  const bg = {
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-emerald-50 border-emerald-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div className={cn('flex gap-2.5 rounded-lg border p-3', bg[alert.tipo])}>
      {icons[alert.tipo]}
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-semibold leading-tight">{alert.titulo}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{alert.descricao}</p>
      </div>
    </div>
  );
}

// ─── Greeting helper ─────────────────────────────────────────────────────────

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t('common.greetings.morning');
  if (h >= 12 && h < 18) return t('common.greetings.afternoon');
  return t('common.greetings.evening');
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Painel() {
  const { t } = useTranslation();
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
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [displayName, setDisplayName] = useState<string>('');

  // ── Fetch user display name ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchName() {
      if (!user) return;
      // Priority: Auth.displayName → profiles.displayName → user_roles.nome (skip placeholder) → email prefix
      if (user.displayName) { setDisplayName(user.displayName); return; }
      try {
        const [roleDoc, profileDoc] = await Promise.all([
          getDoc(doc(db, 'user_roles', user.uid)),
          getDoc(doc(db, 'profiles', user.uid)),
        ]);
        const roleName = roleDoc.exists() ? roleDoc.data().nome : null;
        const profileName = profileDoc.exists() ? (profileDoc.data().displayName || profileDoc.data().nome) : null;

        const resolved = [profileName, roleName].find(
          n => n && n !== 'Usuário sem Nome' && n.trim() !== ''
        );
        if (resolved) { setDisplayName(resolved); return; }

        // Last resort: email prefix capitalised
        if (user.email) {
          const prefix = user.email.split('@')[0];
          setDisplayName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
        }
      } catch { /* silent */ }
    }
    fetchName();
  }, [user]);

  // ── Main data fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAllData() {
      if (!escolaAtivaId) { setLoading(false); return; }
      setLoading(true);
      try {
        await Promise.all([
          fetchStatsAndEvents(),
          fetchFrequenciaData(periodoFrequencia),
          fetchAtividadesRecentes(),
          fetchNotasBimestraisData(),
          fetchAlerts(),
        ]);
      } catch (error) {
        console.error('Painel load error:', error);
        toast.error('Não foi possível carregar todos os dados do painel.');
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, [escolaAtivaId]);

  useEffect(() => {
    fetchFrequenciaData(periodoFrequencia);
  }, [periodoFrequencia, escolaAtivaId]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  async function fetchAlerts() {
    if (!escolaAtivaId || isProfessor) return;
    const newAlerts: DashboardAlert[] = [];
    try {
      // Check missing grades
      const notasSnap = await getDocs(query(collection(db, 'notas'), where('escola_id', '==', escolaAtivaId)));
      const notasDocs = notasSnap.docs.map(d => d.data());
      const missing = notasDocs.filter(n =>
        n.bimestre_1 == null && n.bimestre_2 == null &&
        n.bimestre_3 == null && n.bimestre_4 == null
      ).length;
      if (missing > 0) {
        newAlerts.push({
          id: 'notas',
          tipo: 'warning',
          titulo: `${missing} aluno(s) sem notas lançadas`,
          descricao: 'Verifique os registros e complete os lançamentos pendentes.',
        });
      }

      // Check low attendance
      const freqSnap = await getDocs(query(
        collection(db, 'frequencias'),
        where('escola_id', '==', escolaAtivaId),
        where('status', '==', 'faltou'),
        where('data', '>=', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      ));
      if (freqSnap.size > 10) {
        newAlerts.push({
          id: 'freq',
          tipo: 'warning',
          titulo: `${freqSnap.size} faltas registradas este mês`,
          descricao: 'Taxa de ausência pode estar impactando o aprendizado.',
        });
      }

      // Upcoming events today
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const eventosHojeSnap = await getDocs(query(
        collection(db, 'eventos'),
        where('escola_id', '==', escolaAtivaId),
        where('data', '==', hoje)
      ));
      if (eventosHojeSnap.size > 0) {
        newAlerts.push({
          id: 'eventos-hoje',
          tipo: 'info',
          titulo: `${eventosHojeSnap.size} evento(s) hoje`,
          descricao: 'Verifique o calendário para mais detalhes.',
        });
      }

      if (newAlerts.length === 0) {
        newAlerts.push({
          id: 'ok',
          tipo: 'success',
          titulo: 'Tudo em ordem!',
          descricao: 'Nenhum alerta crítico no momento.',
        });
      }
    } catch { /* silent — permission may be restricted for professor */ }
    setAlerts(newAlerts);
  }

  async function fetchStatsAndEvents() {
    if (!escolaAtivaId) return;
    try {
      if (!navigator.onLine) {
        let estudantesCount = 0;
        let turmasCount = 0;
        let eventosData: Evento[] = [];
        try {
          estudantesCount = await localDb.estudantes.filter(e => e.escola_id === escolaAtivaId).count();
          turmasCount = await localDb.turmas.filter(t => t.escola_id === escolaAtivaId).count();
          const eventosOffline = await localDb.eventos.filter(ev => ev.escola_id === escolaAtivaId).toArray() as Evento[];
          const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0);
          eventosData = eventosOffline
            .filter(e => safeToDate(e.data) >= hojeDate)
            .sort((a, b) => safeToDate(a.data).getTime() - safeToDate(b.data).getTime())
            .slice(0, 5);
        } catch (e) { console.warn('localDb painel error', e); }
        setStats({ totalEstudantes: estudantesCount, totalTurmas: turmasCount, totalProfessores: 0, totalEventos: eventosData.length, mediaNotas: null });
        setProximosEventos(eventosData);
        return;
      }

      const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0);
      const hojeStr = format(hojeDate, 'yyyy-MM-dd');

      const [estudantesSnap, turmasSnap, profsSnap, notasRes, eventosTimestampRes, eventosStringRes] = await Promise.all([
        getCountFromServer(query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId))),
        getCountFromServer(query(collection(db, 'turmas'), where('escola_id', '==', escolaAtivaId))),
        getCountFromServer(query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId))),
        getDocs(query(collection(db, 'notas'), where('escola_id', '==', escolaAtivaId))),
        getDocs(query(collection(db, 'eventos'), where('escola_id', '==', escolaAtivaId), where('data', '>=', hojeDate), orderBy('data', 'asc'))),
        getDocs(query(collection(db, 'eventos'), where('escola_id', '==', escolaAtivaId), where('data', '>=', hojeStr), orderBy('data', 'asc'))),
      ]);

      const eventosMap = new Map<string, Evento>();
      eventosTimestampRes.docs.forEach(d => eventosMap.set(d.id, { id: d.id, ...d.data() } as Evento));
      eventosStringRes.docs.forEach(d => {
        if (!eventosMap.has(d.id)) {
          const data = d.data();
          const timestamp = Timestamp.fromDate(parseISO(data.data as string));
          eventosMap.set(d.id, { ...data, id: d.id, data: timestamp } as Evento);
        }
      });

      const eventosData = Array.from(eventosMap.values())
        .sort((a, b) => a.data.toMillis() - b.data.toMillis())
        .slice(0, 5);

      let mediaNotas: number | null = null;
      const notasData = notasRes.docs.map(d => d.data());
      if (notasData.length > 0) {
        let soma = 0, count = 0;
        notasData.forEach(n => {
          ['bimestre_1','bimestre_2','bimestre_3','bimestre_4'].forEach(k => {
            if (n[k] != null && typeof n[k] === 'number') { soma += n[k]; count++; }
          });
        });
        if (count > 0) mediaNotas = Math.round((soma / count) * 10) / 10;
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
      if (navigator.onLine) {
        console.error('fetchStatsAndEvents error:', error);
        toast.error('Sem permissão para carregar estatísticas e eventos.');
      }
    }
  }

  async function fetchFrequenciaData(periodo: string) {
    try {
      const hoje = new Date();
      let dataInicio: Date;
      const dataFim: Date = hoje;

      if (periodo === 'mes') dataInicio = startOfMonth(hoje);
      else if (periodo === 'ano') dataInicio = subYears(hoje, 1);
      else dataInicio = startOfWeek(hoje, { weekStartsOn: 1 });

      const q = query(
        collection(db, 'frequencias'),
        where('escola_id', '==', escolaAtivaId),
        where('data', '>=', format(dataInicio, 'yyyy-MM-dd')),
        where('data', '<=', format(dataFim, 'yyyy-MM-dd'))
      );
      const snap = await getDocs(q);
      const frequencias = snap.docs.map(d => d.data());

      const estudantesSnap = await getDocs(query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId)));
      const totalAlunos = estudantesSnap.docs.filter(d => {
        const t = d.data().turma_id;
        return t != null && t !== '';
      }).length;

      const agrupados: { [k: number]: { faltas: number } } = { 0:{faltas:0},1:{faltas:0},2:{faltas:0},3:{faltas:0},4:{faltas:0},5:{faltas:0},6:{faltas:0} };
      frequencias.forEach(f => {
        const dia = getDay(parseISO(f.data));
        if (agrupados[dia] && f.status === 'faltou') agrupados[dia].faltas++;
      });

      const dados: FrequenciaData[] = [1, 2, 3, 4, 5].map(dia => ({
        dia: DIAS_SEMANA_CHART[dia],
        taxaFaltas: totalAlunos > 0 ? Math.round((agrupados[dia].faltas / totalAlunos) * 100) : 0,
      }));
      setFrequenciaData(dados);
    } catch (error) {
      if (navigator.onLine) { console.error('fetchFrequenciaData error:', error); }
    }
  }

  async function fetchNotasBimestraisData() {
    if (!escolaAtivaId) return;
    try {
      const snap = await getDocs(query(collection(db, 'notas'), where('escola_id', '==', escolaAtivaId)));
      const notasData = snap.docs.map(d => d.data());
      const bimestres: { [k: string]: { soma: number; count: number } } = {
        '1º Bim':{soma:0,count:0}, '2º Bim':{soma:0,count:0},
        '3º Bim':{soma:0,count:0}, '4º Bim':{soma:0,count:0},
      };
      notasData.forEach(n => {
        if (n.bimestre_1 != null && typeof n.bimestre_1 === 'number') { bimestres['1º Bim'].soma += n.bimestre_1; bimestres['1º Bim'].count++; }
        if (n.bimestre_2 != null && typeof n.bimestre_2 === 'number') { bimestres['2º Bim'].soma += n.bimestre_2; bimestres['2º Bim'].count++; }
        if (n.bimestre_3 != null && typeof n.bimestre_3 === 'number') { bimestres['3º Bim'].soma += n.bimestre_3; bimestres['3º Bim'].count++; }
        if (n.bimestre_4 != null && typeof n.bimestre_4 === 'number') { bimestres['4º Bim'].soma += n.bimestre_4; bimestres['4º Bim'].count++; }
      });
      setNotasBimestraisData(Object.entries(bimestres).map(([key, v]) => ({
        bimestre: key,
        media: v.count > 0 ? Math.round((v.soma / v.count) * 10) / 10 : 0,
      })));
    } catch (error) {
      if (navigator.onLine) { console.error('fetchNotasBimestraisData error:', error); }
    }
  }

  async function fetchAtividadesRecentes() {
    if (isProfessor) return;
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'), limit(4));
      } else {
        if (!escolaAtivaId) return;
        q = query(collection(db, 'activity_log'), where('escola_id', '==', escolaAtivaId), orderBy('created_at', 'desc'), limit(4));
      }
      const snap = await getDocs(q);
      setAtividadesRecentes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ActivityLog)));
    } catch (error) {
      if (navigator.onLine) { console.error('fetchAtividadesRecentes error:', error); }
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleExportReport() {
    const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const printContent = `
      <html><head>
        <title>Relatório do Painel - Diário Digital</title>
        <style>
          body{font-family:Inter,sans-serif;padding:32px;color:#1a1a2e;max-width:820px;margin:0 auto}
          h1{font-size:22px;font-weight:700;margin-bottom:4px}
          .sub{color:#64748b;font-size:13px;margin-bottom:28px}
          .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:28px}
          .card{border:1px solid #e2e8f0;border-radius:10px;padding:16px}
          .card-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
          .card-value{font-size:26px;font-weight:700;margin-top:4px}
          .section-title{font-size:14px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
          .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
        </style>
      </head><body>
        <h1>Relatório do Painel — Diário Digital</h1>
        <div class="sub">Gerado em ${hoje}</div>
        <div class="grid">
          <div class="card"><div class="card-label">Estudantes</div><div class="card-value">${stats.totalEstudantes}</div></div>
          <div class="card"><div class="card-label">Professores</div><div class="card-value">${stats.totalProfessores}</div></div>
          <div class="card"><div class="card-label">Turmas</div><div class="card-value">${stats.totalTurmas}</div></div>
          <div class="card"><div class="card-label">Média de Notas</div><div class="card-value">${stats.mediaNotas?.toFixed(1) ?? 'N/A'}</div></div>
        </div>
        <div class="section-title">Próximos Eventos (${proximosEventos.length})</div>
        ${proximosEventos.map(e => `<p>• ${format(safeToDate(e.data), "dd/MM/yyyy")} — ${e.titulo} (${e.tipo})</p>`).join('') || '<p>Nenhum evento futuro.</p>'}
        <div class="footer">Diário Digital · Relatório gerado automaticamente</div>
      </body></html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) { toast.error('Permita pop-ups para exportar o relatório.'); return; }
    printWin.document.write(printContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
    toast.success('Relatório gerado com sucesso!');
  }

  const getEventTypeVariant = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'feriado':       return 'bg-red-100 text-red-800 border border-red-200';
      case 'prova':         return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'reuniao':       return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'evento escolar':return 'bg-green-100 text-green-800 border border-green-200';
      default:              return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  // ── Quick actions ────────────────────────────────────────────────────────

  const quickActions = [
    { label: 'Diário', icon: ClipboardList, path: '/diario-digital', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
    { label: 'Frequência', icon: Users, path: '/diario-digital', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
    { label: 'Notas', icon: Trophy, path: '/diario-digital', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
    { label: 'Calendário', icon: Calendar, path: '/calendario', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Painel">
      {roleLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">

          {/* ── Header greeting ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {getGreeting(t)}{displayName ? `, ${displayName}` : ''}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('dashboard.welcomeSub')}
              </p>
            </div>
            {!isProfessor && !isEstudante && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 self-start sm:self-auto shadow-sm"
                onClick={handleExportReport}
              >
                <Download className="h-4 w-4" />
                {t('dashboard.exportReport')}
              </Button>
            )}
          </div>

          {/* ── KPI Cards ────────────────────────────────────────────────── */}
          {!isEstudante && (
            loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title={t('dashboard.totalStudents')}
                  value={stats.totalEstudantes}
                  icon={Users}
                  gradient="bg-gradient-to-r from-blue-500 to-blue-600"
                  iconBg="bg-blue-50 text-blue-600"
                />
                <KPICard
                  title={t('dashboard.totalTeachers')}
                  value={stats.totalProfessores}
                  icon={GraduationCap}
                  gradient="bg-gradient-to-r from-violet-500 to-violet-600"
                  iconBg="bg-violet-50 text-violet-600"
                />
                <KPICard
                  title={t('dashboard.totalClasses')}
                  value={stats.totalTurmas}
                  icon={BookOpen}
                  gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
                  iconBg="bg-emerald-50 text-emerald-600"
                />
                <KPICard
                  title={t('dashboard.averageGrades')}
                  value={stats.mediaNotas != null ? stats.mediaNotas.toFixed(1) : 'N/A'}
                  icon={Trophy}
                  gradient="bg-gradient-to-r from-amber-400 to-amber-500"
                  iconBg="bg-amber-50 text-amber-600"
                />
              </div>
            )
          )}

          {/* ── Main grid: chart + sidebar ───────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Chart */}
            {!isEstudante && (
              <Card className="lg:col-span-2 border-0 shadow-soft">
                <Tabs defaultValue="frequencia" onValueChange={setActiveChartTab}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 pt-6 pb-4 gap-4">
                    <div>
                      <p className="font-semibold text-sm">{t('dashboard.performanceTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.performanceSub')}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <TabsList className="w-full sm:w-auto h-8">
                        <TabsTrigger value="frequencia" className="text-xs h-7 flex-1 sm:flex-none">{t('dashboard.generalAttendance')}</TabsTrigger>
                        <TabsTrigger value="notas" className="text-xs h-7 flex-1 sm:flex-none">{t('dashboard.bimonthlyGrades')}</TabsTrigger>
                      </TabsList>
                      {activeChartTab === 'frequencia' && (
                        <Select value={periodoFrequencia} onValueChange={setPeriodoFrequencia}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semana">{t('dashboard.thisWeek')}</SelectItem>
                            <SelectItem value="mes">{t('dashboard.thisMonth')}</SelectItem>
                            <SelectItem value="ano">{t('dashboard.lastYear')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <TabsContent value="frequencia">
                    <CardContent className="h-[280px] pr-2 pb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={frequenciaData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="dia" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                          <RechartsTooltip
                            formatter={(value: number) => [`${value}%`, t('dashboard.absenceRate')]}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                          />
                          <Bar dataKey="taxaFaltas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </TabsContent>

                  <TabsContent value="notas">
                    <CardContent className="h-[280px] pr-2 pb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={notasBimestraisData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="bimestre" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} domain={[0, 10]} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                          />
                          <Bar dataKey="media" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </TabsContent>
                </Tabs>
              </Card>
            )}

            {/* Sidebar: Alerts + Events + Quick Actions */}
            <div className="space-y-4">

              {/* Alerts */}
              {!isProfessor && !isEstudante && (
                <Card className="border-0 shadow-soft">
                  <CardHeader className="pb-3 pt-5 px-5">
                    <CardTitle className="text-sm font-semibold">{t('dashboard.alertsHeader')}</CardTitle>
                    <CardDescription className="text-xs">{t('dashboard.alertsSub')}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-2">
                    {loading ? (
                      <div className="space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
                      </div>
                    ) : alerts.length > 0 ? (
                      alerts.map(a => <AlertItem key={a.id} alert={a} />)
                    ) : (
                      <AlertItem alert={{ id: 'ok', tipo: 'success', titulo: 'Tudo em ordem!', descricao: 'Nenhum alerta crítico.' }} />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card className="border-0 shadow-soft">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold">{t('dashboard.quickActions')}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map(action => (
                      <button
                        key={action.path + action.label}
                        onClick={() => navigate(action.path)}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-xl p-3 text-xs font-semibold transition-all duration-150',
                          action.color
                        )}
                      >
                        <action.icon className="h-5 w-5" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Events */}
              <Card className="border-0 shadow-soft">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar className="h-4 w-4 text-primary" />
                    {t('dashboard.upcomingEvents')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('dashboard.upcomingEventsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {proximosEventos.length > 0 ? proximosEventos.map(evento => (
                        <div key={evento.id} className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-center bg-primary/5 border border-primary/15 p-2 rounded-lg min-w-[52px]">
                            <div className="text-[9px] uppercase text-red-500 font-bold">
                              {format(safeToDate(evento.data), 'MMM', { locale: ptBR })}
                            </div>
                            <div className="text-lg font-bold text-primary leading-tight">
                              {format(safeToDate(evento.data), 'dd')}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">{evento.titulo}</p>
                            <span className={cn('text-[10px] font-medium inline-flex items-center px-2 py-0.5 rounded-full mt-1', getEventTypeVariant(evento.tipo))}>
                              {evento.tipo}
                            </span>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t('dashboard.noUpcomingEvents')}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Recent activities ─────────────────────────────────────────── */}
          {!isProfessor && !isEstudante && (
            <Card className="border-0 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pt-5 px-5 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <List className="h-4 w-4 text-primary" />
                    {t('dashboard.recentActivities')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('dashboard.recentActivitiesDesc')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => navigate('/logs')}>
                  {t('dashboard.viewAll')}
                </Button>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-3/4 bg-muted rounded" />
                          <div className="h-3 w-1/3 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {atividadesRecentes.length > 0 ? atividadesRecentes.map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{activity.user_name || t('dashboard.systemUser')}</span>{' '}
                            {activity.action}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {activity.created_at
                              ? formatDistanceToNow(safeToDate(activity.created_at), { addSuffix: true, locale: ptBR })
                              : t('dashboard.justNow')}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {t('dashboard.noActivitiesYet')}
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