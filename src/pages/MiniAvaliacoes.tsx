import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Sparkles, ClipboardCheck, BarChart2, BookOpen,
  Clock, Users, Loader2, CheckCircle2, AlertCircle, Printer, Trash2
} from "lucide-react";
import { ProvaPDFDialog } from "@/components/relatorios/ProvaPDFDialog";
import { turmaRepo } from "@/repositories/CadastrosRepository";
import { miniAvaliacaoRepo } from "@/repositories/MiniAvaliacaoRepository";
import { estudanteRepo } from "@/repositories/CadastrosRepository";
import { useUserRole } from "@/hooks/useUserRole";
import { format, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function MiniAvaliacoes() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get("componente") || "";
  const navigate = useNavigate();
  const { escolaAtivaId, role } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [turma, setTurma] = useState<any>(null);
  const [miniAvaliacoes, setMiniAvaliacoes] = useState<any[]>([]);
  const [totalEstudantes, setTotalEstudantes] = useState(0);
  const [respostasCounts, setRespostasCounts] = useState<Record<string, number>>({});
  const [selectedPrint, setSelectedPrint] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !escolaAtivaId || !componente) return;
      setLoading(true);
      try {
        // Seed online se disponível
        if (navigator.onLine) {
          try {
            await Promise.all([
              turmaRepo.seed(escolaAtivaId),
              miniAvaliacaoRepo.seedByTurma(turmaId, escolaAtivaId)
            ]);
          } catch (e) {
            console.warn("[MiniAvaliacoes] Erro ao sincronizar:", e);
          }
        }

        const [turmaData, minis, estudantes] = await Promise.all([
          turmaRepo.getById(turmaId),
          miniAvaliacaoRepo.getByTurmaAndComponente(turmaId, componente),
          estudanteRepo.getByTurma(turmaId)
        ]);

        setTurma(turmaData);
        setMiniAvaliacoes(minis.sort((a: any, b: any) =>
          new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
        ));
        setTotalEstudantes(estudantes.length);

        // Carregar contagem de respostas para cada mini-avaliação
        const counts: Record<string, number> = {};
        await Promise.all(
          minis.map(async (mini: any) => {
            if (navigator.onLine) {
              await miniAvaliacaoRepo.seedRespostas(mini.id);
            }
            const respostas = await miniAvaliacaoRepo.getRespostasByMiniAvaliacao(mini.id);
            counts[mini.id] = respostas.length;
          })
        );
        setRespostasCounts(counts);
      } catch (error) {
        console.error("[MiniAvaliacoes] Erro:", error);
        toast.error("Erro ao carregar mini-avaliações.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [turmaId, componente, escolaAtivaId]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta mini avaliação? Ação irreversível.")) {
      try {
        await updateDoc(doc(db, 'mini_avaliacoes', id), {
          excluido: true,
          excluido_em: new Date().toISOString()
        });
        toast.success("Avaliação excluída com sucesso!");
        setMiniAvaliacoes(prev => prev.filter(m => m.id !== id));
      } catch (e) {
        console.error("Erro ao excluir:", e);
        toast.error("Erro ao excluir avaliação.");
      }
    }
  };

  const getProgressColor = (corrigidos: number, total: number) => {
    if (total === 0) return "bg-gray-200";
    const pct = (corrigidos / total) * 100;
    if (pct === 100) return "text-green-600";
    if (pct >= 50) return "text-amber-600";
    return "text-red-500";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <h1 className="text-2xl font-bold tracking-tight">Mini Avaliações</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Turma <span className="font-semibold text-primary">{turma?.nome}</span>
              {componente && <> · <span className="font-semibold text-primary">{componente}</span></>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Avaliações quinzenais diagnósticas baseadas nas habilidades BNCC trabalhadas em sala.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => navigate(`/diario-digital/mini-avaliacoes/${turmaId}/criar?componente=${componente}`)}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Nova Mini-Avaliação com IA
            </Button>
          </div>
        </div>

        {/* Cards de stats rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-purple-100 bg-purple-50/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{miniAvaliacoes.length}</p>
                  <p className="text-xs text-muted-foreground">Avaliações criadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-100 bg-green-50/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalEstudantes}</p>
                  <p className="text-xs text-muted-foreground">Estudantes na turma</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ClipboardCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {miniAvaliacoes.filter(m => (respostasCounts[m.id] || 0) >= totalEstudantes && totalEstudantes > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Avaliações corrigidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Mini-Avaliações */}
        {miniAvaliacoes.length === 0 ? (
          <Card className="border-dashed border-2 border-purple-200">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="p-4 bg-purple-50 rounded-full">
                <Sparkles className="h-10 w-10 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhuma mini-avaliação criada ainda</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Crie sua primeira avaliação quinzenal com IA. O sistema buscará automaticamente
                  as habilidades BNCC que você trabalhou nas últimas semanas.
                </p>
              </div>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white mt-2"
                onClick={() => navigate(`/diario-digital/mini-avaliacoes/${turmaId}/criar?componente=${componente}`)}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Criar Primeira Mini-Avaliação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {miniAvaliacoes.map((mini: any) => {
              const corrigidos = respostasCounts[mini.id] || 0;
              const progresso = totalEstudantes > 0 ? Math.round((corrigidos / totalEstudantes) * 100) : 0;
              const totalCompleto = totalEstudantes > 0 && corrigidos >= totalEstudantes;

              return (
                <Card key={mini.id} className="hover:shadow-md transition-shadow border-l-4 border-l-purple-400">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          {totalCompleto ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-sm">{mini.titulo}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {mini.data_criacao ? format(parseISO(mini.data_criacao), "d 'de' MMM 'de' yyyy", { locale: ptBR }) : "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {mini.questoes?.length || 0} questões
                              </span>
                            </div>
                            {/* Badges de habilidades */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(mini.habilidades || []).slice(0, 5).map((h: string) => (
                                <Badge key={h} variant="outline" className="text-xs py-0 px-1.5 border-purple-300 text-purple-700 bg-purple-50">
                                  {h}
                                </Badge>
                              ))}
                              {(mini.habilidades || []).length > 5 && (
                                <Badge variant="outline" className="text-xs py-0 px-1.5">
                                  +{(mini.habilidades || []).length - 5}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progresso de correção */}
                      <div className="flex flex-col items-end gap-2 shrink-0 min-w-[140px]">
                        <p className={`text-sm font-semibold ${getProgressColor(corrigidos, totalEstudantes)}`}>
                          {corrigidos}/{totalEstudantes} corrigidos
                        </p>
                        <Progress value={progresso} className="h-2 w-32" />
                        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-purple-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => navigate(`/diario-digital/mini-avaliacoes/${turmaId}/corretor/${mini.id}?componente=${componente}`)}
                          >
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Lançar Cartões
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => setSelectedPrint(mini)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => navigate(`/diario-digital/mini-avaliacoes/${turmaId}/diagnostico/${mini.id}?componente=${componente}`)}
                            disabled={corrigidos === 0}
                          >
                            <BarChart2 className="h-4 w-4 mr-2" />
                            Diagnóstico
                          </Button>
                          {(role === 'admin' || role === 'gestor') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(mini.id)}
                              title="Excluir Mini Avaliação"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {selectedPrint && (
        <ProvaPDFDialog
          open={!!selectedPrint}
          onOpenChange={(open) => !open && setSelectedPrint(null)}
          avaliacao={{
            titulo: selectedPrint.titulo || "Mini-Avaliação",
            tipo: "Mini-Avaliação",
            valor: selectedPrint.questoes?.reduce((acc: number, q: any) => acc + (q.valor || 1), 0) || 10,
            bimestre: "Mini",
          }}
          turma={{
            nome: turma?.nome || "",
            serie: turma?.serie || "",
            turno: turma?.turno || "",
          }}
          escolaInfo={{
            nome: "Escola",
            inep: "",
            decreto: "",
          }}
          questoes={(selectedPrint.questoes || []).map((q: any) => ({
            id: q.id,
            tipo: "objetiva",
            enunciado: q.enunciado,
            imagemUrl: q.imagemUrl,
            alternativas: q.alternativas,
            respostaCorreta: q.resposta_correta,
            valor: q.valor,
          }))}
        />
      )}
    </AppLayout>
  );
}
