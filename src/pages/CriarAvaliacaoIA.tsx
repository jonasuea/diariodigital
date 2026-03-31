import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Bot, Sparkles, Printer, Plus, Trash2, Save } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { logActivity } from "@/lib/logger";
import { ProvaPDFDialog, Questao } from "@/components/relatorios/ProvaPDFDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function CriarAvaliacaoIA() {
  const { turmaId, avaliacaoId } = useParams<{ turmaId: string, avaliacaoId: string }>();
  const navigate = useNavigate();
  const { escolaAtivaId } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [avaliacao, setAvaliacao] = useState<any>(null);
  const [turma, setTurma] = useState<any>(null);
  const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
  
  const [questoes, setQuestoes] = useState<Questao[]>([]);

  // AI Config State
  const [aiConfig, setAiConfig] = useState({
    topico: "",
    qtdObjetivas: 5,
    qtdDescritivas: 1,
    dificuldade: "Médio" as "Fácil" | "Médio" | "Difícil"
  });

  useEffect(() => {
    async function fetchData() {
      if (!turmaId || !avaliacaoId || !escolaAtivaId) return;
      try {
        const [avSnap, turmaSnap, escolaSnap] = await Promise.all([
          getDoc(doc(db, "avaliacoes", avaliacaoId)),
          getDoc(doc(db, "turmas", turmaId)),
          getDoc(doc(db, "escolas", escolaAtivaId))
        ]);

        if (avSnap.exists()) {
          const avData = avSnap.data();
          setAvaliacao(avData);
          if (avData.questoes) {
            setQuestoes(avData.questoes);
          }
        }
        if (turmaSnap.exists()) {
          const t = turmaSnap.data();
          setTurma(t);
          setAiConfig(prev => ({ ...prev, topico: avSnap.data()?.titulo || '' }));
        }
        if (escolaSnap.exists()) {
          const eUrl = escolaSnap.data();
          setEscolaInfo({ nome: eUrl.nome, inep: eUrl.inep, decreto: eUrl.decreto_criacao });
        }
      } catch (error) {
        console.error("Erro ao carregar:", error);
        toast.error("Erro ao carregar avaliação.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [turmaId, avaliacaoId, escolaAtivaId]);

  const handleGenerateAI = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      toast.error("Chave de API do Gemini não configurada (VITE_GEMINI_API_KEY no .env)");
      return;
    }

    if (!aiConfig.topico) {
      toast.error("Informe o tópico principal para a IA.");
      return;
    }

    setGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Atue como um professor elaborando uma prova para uma turma de ${turma?.serie || 'ensino básico'}.
Crie uma avaliação sobre o tópico: "${aiConfig.topico}".
O nível de dificuldade deve ser: ${aiConfig.dificuldade}.
Inclua o seguinte formato ESTRITAMENTE em JSON:
{
  "questoes": [
    {
      "tipo": "objetiva" ou "descritiva",
      "enunciado": "Texto da questão...",
      "alternativas": ["a) alt 1", "b) alt 2", "c) alt 3", "d) alt 4"] // Apenas se for objetiva. Forneça exatamente 4 alternativas limpas (sem a letra "a)" no texto, apenas a resposta).,
      "valor": 1
    }
  ]
}
Gere exatamente ${aiConfig.qtdObjetivas} questões objetivas com 4 alternativas e ${aiConfig.qtdDescritivas} questões descritivas.
Retorne APENAS o JSON puro, sem marcações markdown como \`\`\`json.`;

      const result = await model.generateContent(prompt);
      const outputText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsedJSON = JSON.parse(outputText);
      
      if (parsedJSON.questoes && Array.isArray(parsedJSON.questoes)) {
        const generatedQuestoes: Questao[] = parsedJSON.questoes.map((q: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          tipo: q.tipo === 'objetiva' ? 'objetiva' : 'descritiva',
          enunciado: q.enunciado,
          alternativas: q.tipo === 'objetiva' ? q.alternativas || ['', '', '', ''] : null,
          valor: q.valor || 1
        }));

        setQuestoes([...questoes, ...generatedQuestoes]);
        toast.success("Questões geradas com sucesso!");
      } else {
        throw new Error("Formato inválido retornado pela IA");
      }
    } catch (error) {
      console.error(error);
      toast.error("Falha ao gerar as questões com a IA. Tente reescrever o tópico.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveQuestao = (id: string) => {
    setQuestoes(questoes.filter(q => q.id !== id));
  };

  const handleChangeQuestao = (id: string, field: keyof Questao, value: any) => {
    setQuestoes(questoes.map(q => {
      if (q.id === id) {
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const handleChangeAlternativa = (qId: string, index: number, value: string) => {
    setQuestoes(questoes.map(q => {
      if (q.id === qId && q.alternativas) {
        const novasAlt = [...q.alternativas];
        novasAlt[index] = value;
        return { ...q, alternativas: novasAlt };
      }
      return q;
    }));
  };

  const handleImageUpload = async (qId: string, file: File) => {
    try {
      toast.info("Fazendo upload da imagem...");
      const storageRef = ref(storage, `avaliacoes_imagens/${avaliacaoId}/${qId}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      handleChangeQuestao(qId, 'imagemUrl', url);
      toast.success("Upload concluído!");
    } catch (error) {
      console.error("Erro no upload da imagem:", error);
      toast.error("Erro no upload da imagem.");
    }
  };

  const handleSave = async () => {
    if (!avaliacaoId) return;
    setSaving(true);
    try {
      // Sanitiza o array para remover campos undefined (Firestore não aceita undefined)
      const questoesSanitizadas = questoes.map(q => ({
        id: q.id,
        tipo: q.tipo,
        enunciado: q.enunciado ?? '',
        alternativas: q.alternativas ?? null,
        valor: q.valor ?? 1,
        imagemUrl: q.imagemUrl ?? null,
      }));
      await updateDoc(doc(db, "avaliacoes", avaliacaoId), {
        questoes: questoesSanitizadas
      });
      toast.success("Avaliação salva com sucesso!");
      await logActivity(`salvou as questões (via IA) da avaliação "${avaliacao?.titulo}" na turma "${turma?.nome}".`);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 max-w-5xl mx-auto pb-20">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" /> Montar Avaliação com IA
            </h1>
            <p className="text-sm text-muted-foreground line-clamp-2">
              Gere questões automaticamente para <span className="font-semibold text-primary">{avaliacao?.titulo}</span> - Turma <span className="font-semibold text-primary">{turma?.nome}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="shrink-0" disabled={questoes.length === 0}>
              <Printer className="h-4 w-4 mr-2" /> PDF / Imprimir
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* AI Configuration Panel */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
              <Bot className="h-5 w-5" /> Configurar Geração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-4 space-y-2">
                <label className="text-sm font-medium">Tópico Principal / Conteúdo da Prova</label>
                <Input 
                  placeholder="Ex: Frações e números decimais"
                  value={aiConfig.topico}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, topico: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Nº Objetivas</label>
                <Input 
                  type="number" 
                  min={0} max={20}
                  value={aiConfig.qtdObjetivas}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, qtdObjetivas: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nº Descritivas</label>
                <Input 
                  type="number" 
                  min={0} max={10}
                  value={aiConfig.qtdDescritivas}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, qtdDescritivas: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dificuldade</label>
                <Select
                  value={aiConfig.dificuldade}
                  onValueChange={(v) => setAiConfig(prev => ({ ...prev, dificuldade: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fácil">Fácil</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Difícil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700" 
                  onClick={handleGenerateAI}
                  disabled={generating}
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Gerar Questões</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questoes List (Editable) */}
        {questoes.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-purple-100">
            <h3 className="font-bold text-lg text-gray-700">Questões ({questoes.length})</h3>
            
            {questoes.map((questao, index) => (
              <Card key={questao.id} className="relative shadow-sm border-blue-100">
                <div className="absolute top-4 left-4 bg-purple-100 text-purple-800 font-bold w-8 h-8 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <CardHeader className="pl-16 pb-2 flex flex-row justify-between items-start">
                  <div className="flex-1 space-y-2 flex items-center gap-4">
                     <span className="text-sm text-gray-500 font-medium">
                        {questao.tipo === 'objetiva' ? 'Objetiva / Múltipla Escolha' : 'Descritiva / Aberta'}
                     </span>
                     <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Valor:</label>
                      <Input 
                        type="number" 
                        className="w-20" 
                        value={questao.valor} 
                        onChange={(e) => handleChangeQuestao(questao.id, 'valor', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 -mt-2 -mr-2" onClick={() => handleRemoveQuestao(questao.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="pl-16 space-y-4">

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>Imagem (Opcional)</span>
                      {questao.imagemUrl && (
                        <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={() => handleChangeQuestao(questao.id, 'imagemUrl', '')}>
                          Remover Imagem
                        </Button>
                      )}
                    </label>
                    {questao.imagemUrl ? (
                      <div className="border rounded-md p-2 bg-gray-50 inline-block w-fit max-w-full">
                        <img src={questao.imagemUrl} alt="Questão" className="max-h-48 object-contain" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(questao.id, file);
                          }}
                          className="w-full max-w-sm"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enunciado</label>
                    <Textarea 
                      className="min-h-[100px]"
                      value={questao.enunciado}
                      onChange={(e) => handleChangeQuestao(questao.id, 'enunciado', e.target.value)}
                    />
                  </div>

                  {questao.tipo === 'objetiva' && (
                    <div className="space-y-3 pt-4 border-t">
                      <label className="text-sm font-medium">Alternativas</label>
                      {questao.alternativas?.map((alt, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="font-medium text-gray-500 w-6">{String.fromCharCode(97 + i)})</span>
                          <Input 
                            value={alt}
                            onChange={(e) => handleChangeAlternativa(questao.id, i, e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      ))}
                      <div className="pt-2">
                        <Button 
                          variant="outline" size="sm" type="button"
                          onClick={() => handleChangeQuestao(questao.id, 'alternativas', [...(questao.alternativas || []), ''])}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Adicionar Alternativa
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      <ProvaPDFDialog 
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        avaliacao={avaliacao}
        turma={turma}
        escolaInfo={escolaInfo}
        questoes={questoes}
      />
    </AppLayout>
  );
}
