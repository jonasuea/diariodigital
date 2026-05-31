import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, Check, ChevronRight, ChevronLeft,
  CheckCircle2, Circle, AlertCircle, Send
} from "lucide-react";
import { toast } from "sonner";
import { turmaRepo, estudanteRepo } from "@/repositories/CadastrosRepository";
import { miniAvaliacaoRepo } from "@/repositories/MiniAvaliacaoRepository";
import { avaliacaoRepo } from "@/repositories/AvaliacaoRepository";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localDb } from "@/lib/db";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { logActivity } from "@/lib/logger";

const LETRAS = ["A", "B", "C", "D", "E"];

export default function CorretorMiniAvaliacao() {
  const { turmaId, miniId } = useParams<{ turmaId: string; miniId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get("componente") || "";
  const navigate = useNavigate();
  const { escolaAtivaId } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [miniAvaliacao, setMiniAvaliacao] = useState<any>(null);
  const [estudantes, setEstudantes] = useState<any[]>([]);
  const [estudanteIndex, setEstudanteIndex] = useState(0);

  // respostasMap: { [estudanteId]: { [questaoId]: letra_escolhida } }
  const [respostasMap, setRespostasMap] = useState<Record<string, Record<string, string>>>({});

  // Dialog para enviar nota para notas parciais
  const [dialogNotaOpen, setDialogNotaOpen] = useState(false);
  const [notaDestinoEstudante, setNotaDestinoEstudante] = useState<any>(null);
  const [avColuna, setAvColuna] = useState<"AV1" | "AV2" | "AV3" | "AV4">("AV1");
  const [savingNota, setSavingNota] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !miniId || !escolaAtivaId) return;
      setLoading(true);
      try {
        // Seeds online
        if (navigator.onLine) {
          try {
            await Promise.all([
              turmaRepo.seed(escolaAtivaId),
              miniAvaliacaoRepo.seedByTurma(turmaId, escolaAtivaId),
              miniAvaliacaoRepo.seedRespostas(miniId)
            ]);
          } catch (e) {
            console.warn("[Corretor] Seed falhou:", e);
          }
        }

        const [miniData, estudantesData] = await Promise.all([
          miniAvaliacaoRepo.getById(miniId),
          estudanteRepo.getByTurma(turmaId)
        ]);

        if (!miniData) {
          toast.error("Mini-avaliação não encontrada.");
          navigate(-1);
          return;
        }

        setMiniAvaliacao(miniData);
        // Ordenar estudantes por nome
        const sorted = (estudantesData || []).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setEstudantes(sorted);

        // Carregar respostas já salvas
        const respostasExistentes = await miniAvaliacaoRepo.getRespostasByMiniAvaliacao(miniId);
        const map: Record<string, Record<string, string>> = {};
        respostasExistentes.forEach((r: any) => {
          const respostasAluno: Record<string, string> = {};
          Object.entries(r.respostas || {}).forEach(([qId, v]: [string, any]) => {
            respostasAluno[qId] = v.resposta_aluno || "";
          });
          map[r.estudante_id] = respostasAluno;
        });
        setRespostasMap(map);
      } catch (e) {
        console.error("[Corretor] Erro:", e);
        toast.error("Erro ao carregar o corretor.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [turmaId, miniId, escolaAtivaId]);

  const estudanteAtual = estudantes[estudanteIndex];
  const respostasAtual = (estudanteAtual ? respostasMap[estudanteAtual.id] : null) || {};
  const questoes = miniAvaliacao?.questoes || [];
  const numAlts = miniAvaliacao?.qtd_alternativas || 4;
  const letras = LETRAS.slice(0, numAlts);

  // Calcular progresso do estudante atual
  const respondidas = Object.values(respostasAtual).filter(v => v !== "").length;
  const totalQ = questoes.length;

  const setResposta = (questaoId: string, letra: string) => {
    if (!estudanteAtual) return;
    setRespostasMap(prev => ({
      ...prev,
      [estudanteAtual.id]: {
        ...(prev[estudanteAtual.id] || {}),
        [questaoId]: letra
      }
    }));
  };

  const calcularResultado = (estudanteId: string) => {
    const respostas = respostasMap[estudanteId] || {};
    let acertos = 0;
    const detalhes: Record<string, { resposta_aluno: string; correto: boolean; habilidade: string }> = {};
    questoes.forEach((q: any) => {
      const resp = respostas[q.id] || "";
      const correto = resp !== "" && resp === q.resposta_correta;
      if (correto) acertos++;
      detalhes[q.id] = { resposta_aluno: resp, correto, habilidade: q.habilidade || "" };
    });
    const aproveitamento = totalQ > 0 ? Math.round((acertos / totalQ) * 100) : 0;
    return { acertos, aproveitamento, detalhes };
  };

  const handleSalvarEstudante = async () => {
    if (!estudanteAtual || !miniId || !turmaId || !escolaAtivaId) return;
    const { acertos, aproveitamento, detalhes } = calcularResultado(estudanteAtual.id);

    try {
      await miniAvaliacaoRepo.saveResposta({
        id: `${miniId}_${estudanteAtual.id}`,
        mini_avaliacao_id: miniId,
        estudante_id: estudanteAtual.id,
        turma_id: turmaId,
        escola_id: escolaAtivaId,
        componente,
        respostas: detalhes,
        total_questoes: totalQ,
        total_acertos: acertos,
        aproveitamento,
        timestamp: new Date().toISOString(),
      });
      toast.success(`${estudanteAtual.nome} salvo! ${acertos}/${totalQ} acertos (${aproveitamento}%).`);
    } catch (e) {
      toast.error("Erro ao salvar resposta.");
    }
  };

  const handleSalvarEProximo = async () => {
    await handleSalvarEstudante();
    if (estudanteIndex < estudantes.length - 1) {
      setEstudanteIndex(i => i + 1);
    } else {
      toast.success("Todos os estudantes foram corrigidos!");
      navigate(`/diario-digital/mini-avaliacoes/${turmaId}/diagnostico/${miniId}?componente=${componente}`);
    }
  };

  // Lançar nota para notas_parciais
  const handleAbrirDialogNota = (estudante: any) => {
    setNotaDestinoEstudante(estudante);
    setDialogNotaOpen(true);
  };

  const handleLancarNota = async () => {
    if (!notaDestinoEstudante || !turmaId || !escolaAtivaId) return;
    setSavingNota(true);
    try {
      const { aproveitamento } = calcularResultado(notaDestinoEstudante.id);
      const nota = parseFloat(((aproveitamento / 100) * 10).toFixed(2));

      // Buscar nota_parcial existente deste estudante+turma
      const notasParciais = await localDb.notas_parciais
        .where({ turma_id: turmaId, estudante_id: notaDestinoEstudante.id })
        .first();

      if (notasParciais) {
        const payload = {
          ...notasParciais,
          [avColuna.toLowerCase()]: nota,
          updated_at: new Date().toISOString(),
        };
        await localDb.notas_parciais.put(payload);
        await localDb.sync_queue.add({
          collection: "notas_parciais",
          action: "update",
          data: payload,
          timestamp: Date.now(),
        });
        if (navigator.onLine) {
          try {
            await updateDoc(doc(db, "notas_parciais", notasParciais.id), {
              [avColuna.toLowerCase()]: nota,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn("[Corretor] Sync nota falhou, salvo localmente.");
          }
        }
      } else {
        toast.warning("Registro de notas parciais não encontrado para este estudante. Acesse a planilha de notas parciais primeiro.");
        setSavingNota(false);
        return;
      }

      await logActivity(`lançou nota ${nota} (${avColuna}) de "${miniAvaliacao?.titulo}" para ${notaDestinoEstudante.nome}.`);
      toast.success(`Nota ${nota} lançada como ${avColuna} para ${notaDestinoEstudante.nome}.`);
      setDialogNotaOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao lançar nota.");
    } finally {
      setSavingNota(false);
    }
  };

  const getStatusEstudante = (estudanteId: string) => {
    const respostas = respostasMap[estudanteId] || {};
    const totalRespondidas = Object.values(respostas).filter(v => v !== "").length;
    if (totalRespondidas === 0) return "pendente";
    if (totalRespondidas < totalQ) return "parcial";
    return "completo";
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
      <div className="space-y-4 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Check className="h-5 w-5 text-purple-600" /> Corretor
            </h1>
            <p className="text-sm text-muted-foreground">{miniAvaliacao?.titulo} · {totalQ} questões</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Lista de Estudantes */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Estudantes ({estudantes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[70vh] overflow-y-auto divide-y">
                {estudantes.map((est, i) => {
                  const status = getStatusEstudante(est.id);
                  const { aproveitamento } = calcularResultado(est.id);
                  return (
                    <button
                      key={est.id}
                      onClick={() => setEstudanteIndex(i)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2",
                        estudanteIndex === i && "bg-purple-50 border-l-4 border-l-purple-500"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {status === "completo" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : status === "parcial" ? (
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                        )}
                        <span className="text-sm truncate">{est.nome}</span>
                      </div>
                      {status === "completo" && (
                        <Badge className={cn(
                          "text-xs shrink-0",
                          aproveitamento >= 70 ? "bg-green-100 text-green-800" :
                            aproveitamento >= 50 ? "bg-amber-100 text-amber-800" :
                              "bg-red-100 text-red-800"
                        )}>
                          {aproveitamento}%
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Painel de correção */}
          <div className="lg:col-span-3 space-y-4">
            {estudanteAtual ? (
              <>
                {/* Header do estudante atual */}
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-lg">{estudanteAtual.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {respondidas}/{totalQ} questões respondidas
                          {respondidas === totalQ && (
                            <span className="ml-2 text-green-600 font-semibold">
                              · {calcularResultado(estudanteAtual.id).acertos} acertos
                              ({calcularResultado(estudanteAtual.id).aproveitamento}%)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {respondidas === totalQ && (
                          <Button
                            size="sm" variant="outline"
                            className="text-xs text-green-700 border-green-300"
                            onClick={() => handleAbrirDialogNota(estudanteAtual)}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Lançar Nota
                          </Button>
                        )}
                        <Button
                          size="sm" variant="outline"
                          disabled={estudanteIndex === 0}
                          onClick={() => setEstudanteIndex(i => i - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={handleSalvarEProximo}
                        >
                          Salvar e {estudanteIndex < estudantes.length - 1 ? "Próximo" : "Finalizar"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Grid de questões */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {questoes.map((questao: any, qi: number) => {
                    const respostaAluno = respostasAtual[questao.id] || "";
                    const foiRespondida = respostaAluno !== "";
                    const correto = foiRespondida && respostaAluno === questao.resposta_correta;
                    const errado = foiRespondida && respostaAluno !== questao.resposta_correta;

                    return (
                      <Card key={questao.id} className={cn(
                        "border-l-4 transition-all",
                        correto ? "border-l-green-500 bg-green-50/30" :
                          errado ? "border-l-red-400 bg-red-50/20" :
                            "border-l-gray-300"
                      )}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-500">Q{qi + 1}</span>
                              <Badge variant="outline" className="text-xs py-0 px-1.5 border-purple-200 text-purple-600">
                                {questao.habilidade}
                              </Badge>
                            </div>
                            {correto && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {errado && <AlertCircle className="h-4 w-4 text-red-500" />}
                          </div>

                          {/* Linha do enunciado resumido */}
                          <p className="text-xs text-gray-600 mb-3 line-clamp-2">{questao.enunciado}</p>

                          {/* Botões de alternativa */}
                          <div className="flex gap-2 flex-wrap">
                            {letras.map(letra => (
                              <button
                                key={letra}
                                onClick={() => setResposta(questao.id, letra)}
                                className={cn(
                                  "w-9 h-9 rounded-full text-sm font-bold border-2 transition-all hover:scale-110 active:scale-95",
                                  respostaAluno === letra
                                    ? letra === questao.resposta_correta
                                      ? "bg-green-500 border-green-600 text-white shadow-md"
                                      : "bg-red-400 border-red-500 text-white shadow-md"
                                    : letra === questao.resposta_correta && foiRespondida
                                      ? "bg-green-100 border-green-400 text-green-700"
                                      : "bg-white border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-700"
                                )}
                              >
                                {letra}
                              </button>
                            ))}
                            {/* Botão em branco */}
                            <button
                              onClick={() => setResposta(questao.id, "")}
                              className={cn(
                                "px-2 h-9 rounded text-xs border-2 transition-all",
                                respostaAluno === ""
                                  ? "bg-gray-200 border-gray-400 text-gray-700"
                                  : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                              )}
                            >
                              Em branco
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Botão salvar fixo */}
                <div className="flex justify-end gap-3 sticky bottom-4">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
                    onClick={handleSalvarEProximo}
                  >
                    Salvar e {estudanteIndex < estudantes.length - 1 ? "Próximo Estudante" : "Ver Diagnóstico"}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-16">
                  <p className="text-muted-foreground text-sm">Nenhum estudante na turma.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialog: Lançar nota para Notas Parciais */}
      <Dialog open={dialogNotaOpen} onOpenChange={setDialogNotaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lançar Nota nas Parciais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {notaDestinoEstudante && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-semibold">{notaDestinoEstudante.nome}</p>
                {(() => {
                  const { acertos, aproveitamento } = calcularResultado(notaDestinoEstudante.id);
                  const nota = parseFloat(((aproveitamento / 100) * 10).toFixed(2));
                  return (
                    <p className="text-sm text-muted-foreground">
                      {acertos}/{totalQ} acertos → <strong>Nota: {nota}</strong>
                    </p>
                  );
                })()}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Lançar como qual avaliação parcial?</label>
              <Select value={avColuna} onValueChange={v => setAvColuna(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AV1">AV1 – Primeira Avaliação Parcial</SelectItem>
                  <SelectItem value="AV2">AV2 – Segunda Avaliação Parcial</SelectItem>
                  <SelectItem value="AV3">AV3 – Terceira Avaliação Parcial</SelectItem>
                  <SelectItem value="AV4">AV4 – Quarta Avaliação Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNotaOpen(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleLancarNota}
              disabled={savingNota}
            >
              {savingNota ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Confirmar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
