import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BarChart2, Loader2, AlertTriangle, TrendingDown, TrendingUp, Minus, Users
} from "lucide-react";
import { toast } from "sonner";
import { turmaRepo, estudanteRepo } from "@/repositories/CadastrosRepository";
import { miniAvaliacaoRepo } from "@/repositories/MiniAvaliacaoRepository";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface HabilidadeStats {
  code: string;
  totalQuestoes: number;
  totalAcertos: number;
  totalRespondidas: number;
  taxaAcerto: number;
  status: "critico" | "atencao" | "consolidado";
}

interface EstudanteStats {
  id: string;
  nome: string;
  acertos: number;
  total: number;
  aproveitamento: number;
  status: "critico" | "atencao" | "bom";
  habilidadesCriticas: string[];
}

export default function DiagnosticoMiniAvaliacao() {
  const { turmaId, miniId } = useParams<{ turmaId: string; miniId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get("componente") || "";
  const navigate = useNavigate();
  const { escolaAtivaId } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [miniAvaliacao, setMiniAvaliacao] = useState<any>(null);
  const [habilidadesStats, setHabilidadesStats] = useState<HabilidadeStats[]>([]);
  const [estudantesStats, setEstudantesStats] = useState<EstudanteStats[]>([]);
  const [totalEstudantes, setTotalEstudantes] = useState(0);
  const [corrigidos, setCorrigidos] = useState(0);
  const [tab, setTab] = useState<"habilidades" | "estudantes">("habilidades");

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !miniId || !escolaAtivaId) return;
      setLoading(true);
      try {
        if (navigator.onLine) {
          try {
            await Promise.all([
              miniAvaliacaoRepo.seedByTurma(turmaId, escolaAtivaId),
              miniAvaliacaoRepo.seedRespostas(miniId),
            ]);
          } catch (e) {
            console.warn("[Diagnostico] Seed falhou:", e);
          }
        }

        const [miniData, estudantesData, respostasData] = await Promise.all([
          miniAvaliacaoRepo.getById(miniId),
          estudanteRepo.getByTurma(turmaId),
          miniAvaliacaoRepo.getRespostasByMiniAvaliacao(miniId),
        ]);

        if (!miniData) {
          toast.error("Mini-avaliação não encontrada.");
          navigate(-1);
          return;
        }
        setMiniAvaliacao(miniData);

        const estudantes = (estudantesData || []).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setTotalEstudantes(estudantes.length);
        setCorrigidos(respostasData.length);

        // ─── Calcular stats por habilidade ───────────────────────────────
        const questoes: any[] = miniData.questoes || [];
        const habilidadeMap: Record<string, { totalQ: number; totalAcertos: number; totalResp: number }> = {};

        questoes.forEach((q: any) => {
          const hab = q.habilidade || "Sem habilidade";
          if (!habilidadeMap[hab]) habilidadeMap[hab] = { totalQ: 0, totalAcertos: 0, totalResp: 0 };
          habilidadeMap[hab].totalQ += respostasData.length;

          respostasData.forEach((r: any) => {
            const resp = r.respostas?.[q.id];
            if (resp) {
              habilidadeMap[hab].totalResp++;
              if (resp.correto) habilidadeMap[hab].totalAcertos++;
            }
          });
        });

        const habStats: HabilidadeStats[] = Object.entries(habilidadeMap).map(([code, stats]) => {
          const taxa = stats.totalResp > 0
            ? Math.round((stats.totalAcertos / stats.totalResp) * 100)
            : 0;
          return {
            code,
            totalQuestoes: stats.totalQ,
            totalAcertos: stats.totalAcertos,
            totalRespondidas: stats.totalResp,
            taxaAcerto: taxa,
            status: taxa < 50 ? "critico" : taxa < 70 ? "atencao" : "consolidado",
          };
        }).sort((a, b) => a.taxaAcerto - b.taxaAcerto);
        setHabilidadesStats(habStats);

        // ─── Calcular stats por estudante ────────────────────────────────
        const estStats: EstudanteStats[] = estudantes.map((est: any) => {
          const respostaEst = respostasData.find((r: any) => r.estudante_id === est.id);
          if (!respostaEst) {
            return {
              id: est.id,
              nome: est.nome,
              acertos: 0,
              total: questoes.length,
              aproveitamento: 0,
              status: "critico" as const,
              habilidadesCriticas: [],
            };
          }
          const habilidadesCriticas = Object.entries(respostaEst.respostas || {})
            .filter(([, v]: [string, any]) => !v.correto)
            .map(([qId]: [string, any]) => {
              const q = questoes.find((q: any) => q.id === qId);
              return q?.habilidade || "";
            })
            .filter((h: string, i: number, arr: string[]) => h && arr.indexOf(h) === i);

          const aprov = respostaEst.aproveitamento || 0;
          return {
            id: est.id,
            nome: est.nome,
            acertos: respostaEst.total_acertos || 0,
            total: respostaEst.total_questoes || questoes.length,
            aproveitamento: aprov,
            status: aprov < 50 ? "critico" : aprov < 70 ? "atencao" : "bom",
            habilidadesCriticas,
          };
        });
        setEstudantesStats(estStats);
      } catch (e) {
        console.error("[Diagnostico] Erro:", e);
        toast.error("Erro ao carregar diagnóstico.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [turmaId, miniId, escolaAtivaId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </AppLayout>
    );
  }

  const criticoCount = habilidadesStats.filter(h => h.status === "critico").length;
  const atencaoCount = habilidadesStats.filter(h => h.status === "atencao").length;
  const consolidadoCount = habilidadesStats.filter(h => h.status === "consolidado").length;
  const mediaGeral = habilidadesStats.length > 0
    ? Math.round(habilidadesStats.reduce((s, h) => s + h.taxaAcerto, 0) / habilidadesStats.length)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-purple-600" /> Diagnóstico de Habilidades
            </h1>
            <p className="text-sm text-muted-foreground">{miniAvaliacao?.titulo}</p>
            <p className="text-xs text-muted-foreground">{corrigidos}/{totalEstudantes} estudantes corrigidos</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate(`/diario-digital/mini-avaliacoes/${turmaId}/corretor/${miniId}?componente=${componente}`)}>
              Corrigir Mais
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </div>
        </div>

        {/* Stats gerais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold text-purple-700">{mediaGeral}%</p>
              <p className="text-xs text-muted-foreground mt-1">Média geral da turma</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold text-red-600">{criticoCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Habilidades críticas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold text-amber-600">{atencaoCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Em atenção</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold text-green-600">{consolidadoCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Consolidadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Legenda de zonas */}
        <div className="flex flex-wrap gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>🔴 Abaixo de 50% — Crítico: reforço urgente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span>🟡 50%–70% — Atenção: revisão recomendada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>🟢 Acima de 70% — Consolidado</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab("habilidades")}
            className={cn(
              "pb-2 px-3 text-sm font-medium border-b-2 transition-colors",
              tab === "habilidades"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-muted-foreground hover:text-gray-700"
            )}
          >
            Por Habilidade
          </button>
          <button
            onClick={() => setTab("estudantes")}
            className={cn(
              "pb-2 px-3 text-sm font-medium border-b-2 transition-colors",
              tab === "estudantes"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-muted-foreground hover:text-gray-700"
            )}
          >
            Por Estudante
          </button>
        </div>

        {/* Conteúdo: habilidades */}
        {tab === "habilidades" && (
          <div className="space-y-2.5">
            {habilidadesStats.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                Sem dados para exibir. Corrija os cartões primeiro.
              </CardContent></Card>
            ) : habilidadesStats.map(hab => {
              const barColor =
                hab.status === "critico" ? "bg-red-500" :
                  hab.status === "atencao" ? "bg-amber-400" : "bg-green-500";
              const badgeColor =
                hab.status === "critico" ? "bg-red-100 text-red-800 border-red-300" :
                  hab.status === "atencao" ? "bg-amber-100 text-amber-800 border-amber-300" :
                    "bg-green-100 text-green-800 border-green-300";
              const Icon = hab.status === "critico" ? TrendingDown :
                hab.status === "atencao" ? Minus : TrendingUp;

              return (
                <Card key={hab.code} className={cn(
                  "border-l-4",
                  hab.status === "critico" ? "border-l-red-500" :
                    hab.status === "atencao" ? "border-l-amber-400" : "border-l-green-500"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm">{hab.code}</span>
                          <Badge variant="outline" className={cn("text-xs", badgeColor)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {hab.status === "critico" ? "Crítico" :
                              hab.status === "atencao" ? "Atenção" : "Consolidado"}
                          </Badge>
                        </div>
                        {/* Barra de progresso */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", barColor)}
                              style={{ width: `${hab.taxaAcerto}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{hab.taxaAcerto}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {hab.totalAcertos} acertos de {hab.totalRespondidas} respostas
                        </p>
                      </div>
                    </div>
                    {hab.status === "critico" && (
                      <div className="mt-3 flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">
                          Menos de 50% de acerto — Recomenda-se atividade de reforço focada nesta habilidade nas próximas aulas.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Conteúdo: estudantes */}
        {tab === "estudantes" && (
          <div className="space-y-2.5">
            {estudantesStats.map(est => {
              const barColor =
                est.status === "critico" ? "bg-red-500" :
                  est.status === "atencao" ? "bg-amber-400" : "bg-green-500";

              return (
                <Card key={est.id} className={cn(
                  "border-l-4",
                  est.status === "critico" ? "border-l-red-500" :
                    est.status === "atencao" ? "border-l-amber-400" : "border-l-green-500"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm">{est.nome}</span>
                            {est.aproveitamento === 0 && est.acertos === 0 && (
                              <Badge variant="outline" className="text-xs border-gray-300 text-gray-500">
                                Não corrigido
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-bold">
                            {est.acertos}/{est.total}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", barColor)}
                              style={{ width: `${est.aproveitamento}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{est.aproveitamento}%</span>
                        </div>
                        {est.habilidadesCriticas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs text-muted-foreground">Errou em:</span>
                            {est.habilidadesCriticas.slice(0, 5).map(h => (
                              <Badge key={h} variant="outline" className="text-xs py-0 px-1 border-red-300 text-red-700">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
