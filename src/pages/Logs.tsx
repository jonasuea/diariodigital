import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, orderBy, getDocs, Timestamp, where, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Clock, User, Building2, ChevronDown, Loader2 } from 'lucide-react';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [escolasMap, setEscolasMap] = useState<Map<string, string>>(new Map());

  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async (isNextPage = false) => {
    if (!role) return;

    if (isNextPage) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let q;
      const constraints = [];

      if (!isAdmin && escolaAtivaId) {
        constraints.push(where('escola_id', '==', escolaAtivaId));
      } else if (!isAdmin && !escolaAtivaId) {
        setLogs([]);
        setLoading(false);
        return;
      }

      constraints.push(orderBy('created_at', 'desc'));
      constraints.push(limit(PAGE_SIZE));

      if (isNextPage && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      q = query(collection(db, 'activity_log'), ...constraints);

      const querySnapshot = await getDocs(q);
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<ActivityLog, 'id'>)
      } as ActivityLog));

      if (isNextPage) {
        setLogs(prev => [...prev, ...logsData]);
      } else {
        setLogs(logsData);
      }

      setLastVisible(lastDoc || null);
      setHasMore(querySnapshot.docs.length === PAGE_SIZE);

    } catch (error) {
      console.error("Sem permissão para buscar logs:", error);
      toast.error("Não foi possível carregar o histórico de atividades.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [role, isAdmin, escolaAtivaId, lastVisible]);

  useEffect(() => {
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
              <p className="text-sm text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando logs...
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4">
                  {logs.length > 0 ? (
                    logs.map(activity => (
                      <div key={activity.id} className="flex items-start gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                        <div className="flex-shrink-0 pt-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm leading-relaxed">
                            <span className="font-bold text-foreground">{activity.user_name || 'Usuário do Sistema'}</span>
                            <span className="text-muted-foreground"> {activity.action}</span>
                          </p>
                          <div className="flex items-center gap-4">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              {activity.created_at ? formatDistanceToNow(activity.created_at.toDate(), { addSuffix: true, locale: ptBR }) : 'agora mesmo'}
                            </p>
                            {isAdmin && activity.escola_id && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium border-l pl-4">
                                <Building2 className="h-3.5 w-3.5" />
                                {escolasMap.get(activity.escola_id) || activity.escola_id}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Clock className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nenhuma atividade registrada ainda.</p>
                    </div>
                  )}
                </div>

                {hasMore && logs.length >= PAGE_SIZE && (
                  <div className="pt-6 border-t flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLogs(true)}
                      disabled={loadingMore}
                      className="min-w-[150px] gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Carregar Mais
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
