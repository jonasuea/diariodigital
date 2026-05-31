import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Sparkles, Loader2, Save, Trash2, Plus, Image as ImageIcon,
  Check, BookOpen, AlertTriangle, RefreshCw, X, Printer
} from "lucide-react";
import { ProvaPDFDialog, Questao } from "@/components/relatorios/ProvaPDFDialog";
import { db, storage, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { logActivity } from "@/lib/logger";
import { turmaRepo } from "@/repositories/CadastrosRepository";
import { planejamentoRepo } from "@/repositories/PlanejamentoRepository";
import { miniAvaliacaoRepo } from "@/repositories/MiniAvaliacaoRepository";
import { useUserRole } from "@/hooks/useUserRole";
import { subDays, format } from "date-fns";

const LETRAS = ["A", "B", "C", "D", "E"];

interface MiniQuestao {
  id: string;
  enunciado: string;
  alternativas: string[];
  resposta_correta: string;
  habilidade: string;
  valor: number;
  imagemUrl?: string;
}

const PERIODOS = [
  { label: "Últimos 15 dias (Recomendado MEC)", value: 15 },
  { label: "Últimos 30 dias", value: 30 },
  { label: "Últimas 13 semanas (91 dias)", value: 91 },
];

export default function CriarMiniAvaliacaoIA() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get("componente") || "";
  const navigate = useNavigate();
  const { escolaAtivaId } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [turma, setTurma] = useState<any>(null);
  const [escolaInfo, setEscolaInfo] = useState({ nome: "", inep: "", decreto: "" });

  // Passo 1: seleção de habilidades
  const [periodo, setPeriodo] = useState(15);
  const [habilidadesDisponiveis, setHabilidadesDisponiveis] = useState<{ code: string; descricao: string }[]>([]);
  const [habilidadesSelecionadas, setHabilidadesSelecionadas] = useState<string[]>([]);
  const [loadingHabilidades, setLoadingHabilidades] = useState(false);

  // Passo 2: config da IA
  const [titulo, setTitulo] = useState("");
  const [qtdQuestoes, setQtdQuestoes] = useState(10);
  const [qtdAlternativas, setQtdAlternativas] = useState(4);
  const [dificuldade, setDificuldade] = useState<"Fácil" | "Médio" | "Difícil">("Médio");

  // Passo 3: questões geradas
  const [questoes, setQuestoes] = useState<MiniQuestao[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    async function fetchBase() {
      if (!turmaId || !escolaAtivaId) return;
      setLoading(true);
      try {
        const turmaData = await turmaRepo.getById(turmaId);
        setTurma(turmaData);

        // Seed registros de aulas para ter dados offline
        if (navigator.onLine && turmaData) {
          try {
            await planejamentoRepo.seedRegistros(turmaId, componente);
          } catch (e) {
            console.warn("[CriarMini] Seed falhou:", e);
          }
        }

        // Informações da escola
        try {
          const escolaSnap = await getDoc(doc(db, "escolas", escolaAtivaId));
          if (escolaSnap.exists()) {
            const d = escolaSnap.data();
            setEscolaInfo({ nome: d.nome, inep: d.inep, decreto: d.decreto_criacao });
          }
        } catch (e) {
          console.warn("[CriarMini] Erro ao buscar escola:", e);
        }
      } catch (e) {
        toast.error("Erro ao carregar dados da turma.");
      } finally {
        setLoading(false);
      }
    }
    fetchBase();
  }, [turmaId, escolaAtivaId, componente]);

  // Buscar habilidades quando o período mudar
  const handleBuscarHabilidades = async () => {
    if (!turmaId || !componente) return;
    setLoadingHabilidades(true);
    try {
      const codes = await miniAvaliacaoRepo.getHabilidadesTrabalhadas(turmaId, componente, periodo);

      if (codes.length === 0) {
        toast.warning("Nenhuma habilidade registrada no período selecionado. Registre as aulas no calendário primeiro.");
        setHabilidadesDisponiveis([]);
        return;
      }

      // Buscar descrições na base curricular local
      const serie = turma?.serie || "";
      const baseCurricular = await planejamentoRepo.getBaseCurricularLocal(serie, componente);
      const descMap: Record<string, string> = {};
      baseCurricular.forEach((item: any) => {
        (item.objetos || []).forEach((obj: any) => {
          (obj.habilidades || []).forEach((h: any) => {
            if (h.code) descMap[h.code] = h.description || h.code;
          });
        });
      });

      const habilidades = codes.map(code => ({
        code,
        descricao: descMap[code] || code
      }));

      setHabilidadesDisponiveis(habilidades);
      setHabilidadesSelecionadas(codes); // pré-selecionar todas
      toast.success(`${habilidades.length} habilidade(s) encontrada(s) nos últimos ${periodo} dias.`);
    } catch (e) {
      toast.error("Erro ao buscar habilidades trabalhadas.");
      console.error(e);
    } finally {
      setLoadingHabilidades(false);
    }
  };

  const toggleHabilidade = (code: string) => {
    setHabilidadesSelecionadas(prev =>
      prev.includes(code) ? prev.filter(h => h !== code) : [...prev, code]
    );
  };

  const handleGerar = async () => {
    if (habilidadesSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma habilidade para gerar questões.");
      return;
    }
    setGenerating(true);
    try {
      const descricaoHabilidades: Record<string, string> = {};
      habilidadesDisponiveis.forEach(h => { descricaoHabilidades[h.code] = h.descricao; });

      const generateMiniQuestions = httpsCallable(functions, "generateMiniQuestionsWithIA");
      const response = await generateMiniQuestions({
        habilidades: habilidadesSelecionadas,
        descricaoHabilidades,
        qtdQuestoes,
        qtdAlternativas,
        dificuldade,
        serie: turma?.serie || "",
        componente,
      });

      const parsed = response.data as { questoes: any[] };
      if (!parsed.questoes || !Array.isArray(parsed.questoes)) {
        throw new Error("Formato inválido retornado pela IA.");
      }

      const letras = LETRAS.slice(0, qtdAlternativas);
      const geradas: MiniQuestao[] = parsed.questoes.map((q: any) => ({
        id: crypto.randomUUID(),
        enunciado: q.enunciado || "",
        alternativas: Array.isArray(q.alternativas)
          ? q.alternativas.slice(0, qtdAlternativas)
          : letras.map(() => ""),
        resposta_correta: q.resposta_correta || "A",
        habilidade: q.habilidade || habilidadesSelecionadas[0] || "",
        valor: q.valor || 1,
      }));

      setQuestoes(geradas);
      setStep(3);
      toast.success(`${geradas.length} questões geradas com sucesso!`);
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar questões. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleImageUpload = async (questaoId: string, file: File) => {
    try {
      toast.info("Fazendo upload da imagem...");
      const storageRef = ref(storage, `mini_avaliacoes_imagens/${turmaId}/${questaoId}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setQuestoes(qs => qs.map(q => q.id === questaoId ? { ...q, imagemUrl: url } : q));
      toast.success("Upload concluído!");
    } catch (e) {
      toast.error("Erro no upload da imagem.");
    }
  };

  const handleGerarImagemIA = async (questao: any) => {
    toast.info("Gerando imagem com IA...", { toastId: `ia_${questao.id}` });
    try {
      const prompt = `crie uma imagem para uma questão de uma avaliação da turma ${turma?.nome || "escolar"}, na imagem deve ter o contexto para o enunciado: ${questao.enunciado}, que faz parte da habilidade: ${questao.habilidade}.`;
      // Usamos uma seed aleatória para forçar uma nova imagem caso o professor clique de novo
      const seed = Math.floor(Math.random() * 1000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=800&height=600&seed=${seed}`;
      
      // Apenas salva a URL diretamente. O navegador vai carregar a imagem na tag <img> sem erro de CORS
      setQuestoes(qs => qs.map(q => q.id === questao.id ? { ...q, imagemUrl: pollinationsUrl } : q));
      
      toast.success("Imagem gerada com sucesso!");
    } catch (e) {
      console.error("Erro ao gerar imagem:", e);
      toast.error("Erro ao gerar imagem com IA.");
    }
  };

  const handleSalvar = async () => {
    if (!turmaId || !escolaAtivaId || questoes.length === 0) return;
    if (!titulo.trim()) {
      toast.error("Informe um título para a mini-avaliação.");
      return;
    }
    setSaving(true);
    try {
      const questoesSanitizadas = questoes.map(q => ({
        id: q.id,
        enunciado: q.enunciado ?? "",
        alternativas: q.alternativas ?? [],
        resposta_correta: q.resposta_correta ?? "A",
        habilidade: q.habilidade ?? "",
        valor: q.valor ?? 1,
        imagemUrl: q.imagemUrl ?? null,
      }));

      const habilidadesUnicas = Array.from(new Set(questoesSanitizadas.map(q => q.habilidade).filter(Boolean)));

      const id = await miniAvaliacaoRepo.saveMiniAvaliacao({
        titulo: titulo.trim(),
        turma_id: turmaId,
        escola_id: escolaAtivaId,
        componente,
        habilidades: habilidadesUnicas,
        questoes: questoesSanitizadas,
        qtd_alternativas: qtdAlternativas,
        dificuldade,
        data_criacao: new Date().toISOString(),
      });

      toast.success("Mini-avaliação salva com sucesso!");
      await logActivity(`criou a mini-avaliação "${titulo}" para a turma "${turma?.nome}" (${componente}).`);
      navigate(`/diario-digital/mini-avaliacoes`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar a mini-avaliação.");
    } finally {
      setSaving(false);
    }
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
      <div className="space-y-6 max-w-5xl mx-auto pb-20">
        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" /> Nova Mini-Avaliação com IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Turma <span className="font-semibold text-primary">{turma?.nome}</span> · {componente}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Habilidades" },
            { n: 2, label: "Configurar IA" },
            { n: 3, label: "Revisar Questões" },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step >= n ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                {step > n ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={step >= n ? "font-semibold text-purple-700" : "text-muted-foreground"}>{label}</span>
              {n < 3 && <div className={`h-px w-8 ${step > n ? "bg-purple-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* PASSO 1: Habilidades */}
        {step === 1 && (
          <Card className="border-purple-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-600" />
                Passo 1: Selecione as Habilidades a Avaliar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1.5 block">Período de busca</label>
                  <Select value={String(periodo)} onValueChange={v => setPeriodo(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODOS.map(p => (
                        <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleBuscarHabilidades}
                    disabled={loadingHabilidades}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loadingHabilidades ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Buscar Habilidades
                  </Button>
                </div>
              </div>

              {habilidadesDisponiveis.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      {habilidadesDisponiveis.length} habilidade(s) encontrada(s) nos registros de aula
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setHabilidadesSelecionadas(habilidadesDisponiveis.map(h => h.code))}>
                        Selecionar Todas
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setHabilidadesSelecionadas([])}>
                        Limpar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                    {habilidadesDisponiveis.map(hab => (
                      <div
                        key={hab.code}
                        onClick={() => toggleHabilidade(hab.code)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${habilidadesSelecionadas.includes(hab.code)
                            ? "border-purple-400 bg-purple-50"
                            : "border-gray-200 hover:border-purple-200 hover:bg-gray-50"
                          }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5
                          ${habilidadesSelecionadas.includes(hab.code)
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-300"
                          }`}>
                          {habilidadesSelecionadas.includes(hab.code) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-purple-800">{hab.code}</span>
                          <p className="text-xs text-gray-600 mt-0.5">{hab.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={habilidadesSelecionadas.length === 0}
                      onClick={() => setStep(2)}
                    >
                      Próximo: Configurar IA <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </>
              )}

              {habilidadesDisponiveis.length === 0 && !loadingHabilidades && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    Clique em "Buscar Habilidades" para localizar as habilidades registradas nos diários de aula
                    no período selecionado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PASSO 2: Configuração da IA */}
        {step === 2 && (
          <Card className="border-purple-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Passo 2: Configurar a Geração por IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título da Mini-Avaliação</label>
                <Input
                  placeholder="Ex: Mini-Avaliação Diagnóstica – Semana 3"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs font-semibold text-purple-700 mb-2">
                  Habilidades selecionadas ({habilidadesSelecionadas.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {habilidadesSelecionadas.map(code => (
                    <Badge key={code} className="bg-purple-600 text-white text-xs">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nº de Questões</label>
                  <Input
                    type="number"
                    min={5} max={30}
                    value={qtdQuestoes}
                    onChange={e => setQtdQuestoes(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nº de Alternativas</label>
                  <Select value={String(qtdAlternativas)} onValueChange={v => setQtdAlternativas(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 alternativas (A, B, C)</SelectItem>
                      <SelectItem value="4">4 alternativas (A, B, C, D)</SelectItem>
                      <SelectItem value="5">5 alternativas (A, B, C, D, E)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dificuldade</label>
                  <Select value={dificuldade} onValueChange={v => setDificuldade(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fácil">Fácil</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Difícil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleGerar}
                  disabled={generating || !titulo.trim()}
                >
                  {generating
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                    : <><Sparkles className="h-4 w-4 mr-2" /> Gerar {qtdQuestoes} Questões</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASSO 3: Revisar questões geradas */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {questoes.length} Questões Geradas — Revise e Salve
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Regerar
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={questoes.length === 0}
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleSalvar}
                  disabled={saving}
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                    : <><Save className="h-4 w-4 mr-2" /> Salvar Avaliação</>
                  }
                </Button>
              </div>
            </div>

            {questoes.map((questao, index) => {
              const letras = LETRAS.slice(0, qtdAlternativas);
              return (
                <Card key={questao.id} className="relative shadow-sm border-l-4 border-l-purple-400">
                  <div className="absolute top-4 left-4 bg-purple-100 text-purple-800 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </div>
                  <CardHeader className="pl-16 pb-2 flex flex-row justify-between items-start">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 text-xs">
                        {questao.habilidade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Valor: {questao.valor} pt</span>
                      {/* Gabarito */}
                      <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-bold">
                        Gabarito: {questao.resposta_correta}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 -mt-2 -mr-2"
                      onClick={() => setQuestoes(qs => qs.filter(q => q.id !== questao.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="pl-16 space-y-4">
                    {/* Enunciado */}
                    <Textarea
                      value={questao.enunciado}
                      onChange={e => setQuestoes(qs => qs.map(q => q.id === questao.id ? { ...q, enunciado: e.target.value } : q))}
                      className="min-h-[80px]"
                    />

                    {/* Imagem */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" /> Imagem (opcional)
                      </label>
                      {questao.imagemUrl ? (
                        <div className="relative inline-block">
                          <img src={questao.imagemUrl} alt="Questão" className="max-h-40 rounded border" />
                          <button
                            onClick={() => setQuestoes(qs => qs.map(q => q.id === questao.id ? { ...q, imagemUrl: "" } : q))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-row items-center gap-2">
                          <Input type="file" accept="image/*"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(questao.id, f); }}
                            className="w-full max-w-xs text-xs"
                          />
                          <span className="text-xs text-muted-foreground font-medium">ou</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                            onClick={() => handleGerarImagemIA(questao)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Criar por IA
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Alternativas */}
                    <div className="space-y-2">
                      {questao.alternativas.map((alt, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                            ${questao.resposta_correta === letras[i]
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-600"
                            }`}>
                            {letras[i]}
                          </div>
                          <Input
                            value={alt}
                            onChange={e => setQuestoes(qs => qs.map(q => {
                              if (q.id !== questao.id) return q;
                              const alts = [...q.alternativas];
                              alts[i] = e.target.value;
                              return { ...q, alternativas: alts };
                            }))}
                            className="flex-1"
                          />
                          <Button
                            size="sm" variant="ghost"
                            className={`text-xs h-8 shrink-0 ${questao.resposta_correta === letras[i] ? "text-green-700" : "text-gray-400"}`}
                            onClick={() => setQuestoes(qs => qs.map(q => q.id === questao.id ? { ...q, resposta_correta: letras[i] } : q))}
                          >
                            {questao.resposta_correta === letras[i] ? <Check className="h-4 w-4" /> : "Gabarito"}
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Habilidade vinculada */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground shrink-0">Habilidade BNCC:</label>
                      <Select
                        value={questao.habilidade}
                        onValueChange={v => setQuestoes(qs => qs.map(q => q.id === questao.id ? { ...q, habilidade: v } : q))}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {habilidadesSelecionadas.map(code => (
                            <SelectItem key={code} value={code}>{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Botão adicionar questão manual */}
            <Button
              variant="outline"
              className="w-full py-6 text-purple-600 border-purple-200 border-dashed hover:bg-purple-50"
              onClick={() => setQuestoes(qs => [...qs, {
                id: crypto.randomUUID(),
                enunciado: "",
                alternativas: LETRAS.slice(0, qtdAlternativas).map(() => ""),
                resposta_correta: "A",
                habilidade: habilidadesSelecionadas[0] || "",
                valor: 1,
              }])}
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar Questão Manual
            </Button>

            {/* Botão salvar fixo no fundo */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-end gap-3 shadow-lg z-50">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Reconfigurar
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={questoes.length === 0}
              >
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white px-8"
                onClick={handleSalvar}
                disabled={saving || questoes.length === 0}
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  : <><Save className="h-4 w-4 mr-2" /> Salvar Avaliação</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
      <ProvaPDFDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        avaliacao={{
          titulo: titulo || "Mini-Avaliação",
          tipo: "Mini-Avaliação",
          valor: questoes.reduce((acc, q) => acc + (q.valor || 1), 0),
          bimestre: "Mini",
        }}
        turma={{
          nome: turma?.nome || "",
          serie: turma?.serie || "",
          turno: turma?.turno || "",
        }}
        escolaInfo={escolaInfo}
        questoes={questoes.map((q) => ({
          id: q.id,
          tipo: "objetiva",
          enunciado: q.enunciado,
          imagemUrl: q.imagemUrl,
          alternativas: q.alternativas,
          respostaCorreta: q.resposta_correta,
          valor: q.valor,
        }))}
      />
    </AppLayout>
  );
}
