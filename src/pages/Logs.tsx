import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, orderBy, getDocs, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Clock, User, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface ActivityLog {
  id: string;
  user_name: string;
  action: string;
  created_at: Timestamp;
  escola_id?: string;
}

export default function Logs() {
  const navigate = useNavigate();
  const { role, escolaAtivaId, isAdmin } = useUserRole();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [escolasMap, setEscolasMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!role) return; // Aguarda o role ser carregado
    async function fetchLogs() {
      setLoading(true);
      try {
        let q;
        if (isAdmin) {
          // Admin vê todos os logs
          q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'));
        } else if (escolaAtivaId) {
          // Demais usuários vêem apenas os logs da escola ativa
          q = query(
            collection(db, 'activity_log'),
            where('escola_id', '==', escolaAtivaId),
            orderBy('created_at', 'desc')
          );
        } else {
          setLogs([]);
          setLoading(false);
          return;
        }

        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<ActivityLog, 'id'>)
        } as ActivityLog));
        setLogs(logsData);
      } catch (error) {
        console.error("Erro ao buscar logs:", error);
        toast.error("Não foi possível carregar o histórico de atividades.");
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();

    // Admin: pre-carrega mapa de escolas para exibir nomes nos logs
    if (isAdmin) {
      getDocs(collection(db, 'escolas')).then(snap => {
        const map = new Map<string, string>();
        snap.docs.forEach(d => map.set(d.id, (d.data() as any).nome || d.id));
        setEscolasMap(map);
      });
    }
  }, [role, isAdmin, escolaAtivaId]);

  return (
    <AppLayout title="Histórico de Atividades">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Histórico de Atividades</h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? 'Visualizando todos os logs da rede municipal.'
                : 'Visualizando os logs da sua escola.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin ? 'Todos os Logs da Rede' : 'Logs da Escola'}
            </CardTitle>
            <CardDescription>
              Lista de atividades em ordem cronológica decrescente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando logs...</p>
            ) : (
              <div className="space-y-1">
                {logs.length > 0 ? (
                  logs.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="flex-shrink-0 pt-1">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{activity.user_name || 'Usuário do Sistema'}</span> {activity.action}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {activity.created_at ? formatDistanceToNow(activity.created_at.toDate(), { addSuffix: true, locale: ptBR }) : 'agora mesmo'}
                          </p>
                          {isAdmin && activity.escola_id && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {escolasMap.get(activity.escola_id) || activity.escola_id}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
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