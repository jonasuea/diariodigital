import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save, X, Search, Check, ClipboardList } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Turma {
  id: string;
  nome: string;
}

export default function RegistroAvaliacao() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');
  const dataParams = searchParams.get('data');

  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [objetosMinistrados, setObjetosMinistrados] = useState<string[]>([]);
  const [loadingObjetos, setLoadingObjetos] = useState(false);

  const [formData, setFormData] = useState({
    titulo: "",
    tipo: "PROVA",
    valor: "",
    objetosConhecimento: [] as string[],
    observacao: ""
  });

  useEffect(() => {
    async function fetchInitialData() {
      if (!turmaId) return;
      try {
        const docRef = doc(db, 'turmas', turmaId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setTurma({ id: snapshot.id, ...snapshot.data() } as Turma);
        }

        // Buscar objetos de conhecimento ministrados para esta turma/componente
        if (componente) {
          setLoadingObjetos(true);
          const qMinistrados = query(
            collection(db, 'registros_aulas'),
            where('turma_id', '==', turmaId),
            where('componente', '==', componente),
            where('status', '==', 'Ministrado')
          );
          const snapMinistrados = await getDocs(qMinistrados);
          const objetos = new Set<string>();
          snapMinistrados.forEach(doc => {
            const data = doc.data();
            if (data.objetosConhecimento) {
              data.objetosConhecimento.forEach((obj: string) => objetos.add(obj));
            }
          });
          setObjetosMinistrados(Array.from(objetos).sort());
          setLoadingObjetos(false);
        }

        // Buscar registro existente para esta data/turma/componente
        if (componente && dataParams) {
          const q = query(
            collection(db, 'avaliacoes'),
            where('turma_id', '==', turmaId),
            where('componente', '==', componente),
            where('data', '==', dataParams)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const existingDoc = snap.docs[0];
            const data = existingDoc.data();
            setEditingId(existingDoc.id);
            setFormData({
              titulo: data.titulo || "",
              tipo: data.tipo || "PROVA",
              valor: data.valor || "",
              objetosConhecimento: data.objetosConhecimento || [],
              observacao: data.observacao || ""
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [turmaId, componente, dataParams]);

  const handleSave = async () => {
    if (!turmaId || !componente || !dataParams) return;

    if (!formData.titulo || formData.objetosConhecimento.length === 0) {
      toast.error("Por favor, preencha o título e selecione pelo menos um objeto de conhecimento.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        turma_id: turmaId,
        componente,
        data: dataParams,
        ...formData,
        updated_at: Timestamp.now()
      };

      if (editingId) {
        await updateDoc(doc(db, "avaliacoes", editingId), payload);
      } else {
        await addDoc(collection(db, "avaliacoes"), {
          ...payload,
          created_at: Timestamp.now()
        });
      }

      toast.success(editingId ? "Avaliação atualizada!" : "Avaliação salva com sucesso!");
      navigate(-1);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar a avaliação.");
    } finally {
      setSaving(false);
    }
  };

  const toggleObjetoConhecimento = (objeto: string) => {
    setFormData(prev => {
      const isSelected = prev.objetosConhecimento.includes(objeto);
      const newObjetos = isSelected
        ? prev.objetosConhecimento.filter(o => o !== objeto)
        : [...prev.objetosConhecimento, objeto];
      return { ...prev, objetosConhecimento: newObjetos };
    });
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

  const dataFormatada = dataParams ? format(parseISO(dataParams), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Registro de Avaliação</h1>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              Agende uma avaliação para a turma <span className="font-semibold text-primary">{turma?.nome}</span> no componente <span className="font-semibold text-primary">{componente}</span>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden xs:inline">Voltar para o Calendário</span>
            <span className="xs:hidden">Voltar</span>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {dataFormatada}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-sm font-medium">Título da Avaliação</label>
                <Input
                  placeholder="Ex: Prova Mensal..."
                  value={formData.titulo}
                  onChange={(e) => setFormData(f => ({ ...f, titulo: e.target.value }))}
                  className="bg-slate-50/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Avaliação</label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData(f => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger className="bg-slate-50/50">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVALIACAO ORAL">AVALIACAO ORAL</SelectItem>
                    <SelectItem value="TRABALHO">TRABALHO</SelectItem>
                    <SelectItem value="TRABALHO EM GRUPO">TRABALHO EM GRUPO</SelectItem>
                    <SelectItem value="SEMINARIO">SEMINARIO</SelectItem>
                    <SelectItem value="EXERCICIOS">EXERCICIOS</SelectItem>
                    <SelectItem value="REDACAO">REDACAO</SelectItem>
                    <SelectItem value="LEITURA">LEITURA</SelectItem>
                    <SelectItem value="DISSERTACAO">DISSERTACAO</SelectItem>
                    <SelectItem value="FEIRA INTERDISCIPLINAR">FEIRA INTERDISCIPLINAR</SelectItem>
                    <SelectItem value="ASPECTOS CUMULATIVOS">ASPECTOS CUMULATIVOS</SelectItem>
                    <SelectItem value="LEITURA IMAGEM">LEITURA IMAGEM</SelectItem>
                    <SelectItem value="EXPERIMENTOS">EXPERIMENTOS</SelectItem>
                    <SelectItem value="SIMULADO">SIMULADO</SelectItem>
                    <SelectItem value="ATIVIDADE PRATICA">ATIVIDADE PRATICA</SelectItem>
                    <SelectItem value="RELATORIO">RELATORIO</SelectItem>
                    <SelectItem value="DESENHO">DESENHO</SelectItem>
                    <SelectItem value="FORUM">FORUM</SelectItem>
                    <SelectItem value="CANTO">CANTO</SelectItem>
                    <SelectItem value="TABELAS">TABELAS</SelectItem>
                    <SelectItem value="GRAFICOS">GRAFICOS</SelectItem>
                    <SelectItem value="JOGOS">JOGOS</SelectItem>
                    <SelectItem value="INTERPRETACAO DE TEXTO">INTERPRETACAO DE TEXTO</SelectItem>
                    <SelectItem value="VIDEOS/SLIDES(CRIACAO)">VIDEOS/SLIDES(CRIACAO)</SelectItem>
                    <SelectItem value="MAPAS">MAPAS</SelectItem>
                    <SelectItem value="EXPRESSAO CORPORAL(TEATRO/DANCA)">EXPRESSAO CORPORAL(TEATRO/DANCA)</SelectItem>
                    <SelectItem value="AVALIAÇÃO OBJETIVA">AVALIAÇÃO OBJETIVA</SelectItem>
                    <SelectItem value="AVALIAÇÃO DISCURSIVA">AVALIAÇÃO DISCURSIVA</SelectItem>
                    <SelectItem value="EXPOSIÇÃO DE TRABALHOS PARA A COMUNIDADE ESCOLAR">EXPOSIÇÃO DE TRABALHOS PARA A COMUNIDADE ESCOLAR</SelectItem>
                    <SelectItem value="ENCONTRO COM PALESTRANTES">ENCONTRO COM PALESTRANTES</SelectItem>
                    <SelectItem value="DINAMICA LOCAL INTERATIVA - DLI">DINAMICA LOCAL INTERATIVA - DLI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Valor (Nota)</label>
                <Input
                  type="text"
                  placeholder="Ex: 10,0"
                  value={formData.valor}
                  onChange={(e) => setFormData(f => ({ ...f, valor: e.target.value }))}
                  className="bg-slate-50/50"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Objetos de Conhecimento Avaliados</label>
              <p className="text-xs text-muted-foreground">Selecione os conteúdos ministrados que serão cobrados nesta avaliação.</p>

              <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-slate-50/30">
                {formData.objetosConhecimento.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nenhum objeto selecionado</span>
                ) : (
                  formData.objetosConhecimento.map((obj) => (
                    <Badge key={obj} variant="secondary" className="gap-1 pr-1 max-w-full">
                      <span className="truncate">{obj}</span>
                      <button
                        onClick={() => toggleObjetoConhecimento(obj)}
                        className="p-0.5 hover:bg-slate-200 rounded-full shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-white text-left font-normal"
                    disabled={loadingObjetos}
                  >
                    {loadingObjetos ? "Carregando conteúdos..." : "Selecionar objetos de conhecimento..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar conteúdo ministrado..." />
                    <CommandList>
                      <CommandEmpty>
                        {objetosMinistrados.length === 0
                          ? "Nenhum conteúdo ministrado registrado para esta turma."
                          : "Nenhum conteúdo encontrado."}
                      </CommandEmpty>
                      <CommandGroup>
                        {objetosMinistrados.map((obj) => (
                          <CommandItem
                            key={obj}
                            value={obj}
                            onSelect={() => toggleObjetoConhecimento(obj)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.objetosConhecimento.includes(obj) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {obj}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Critérios de Avaliação / Observações</label>
              <Textarea
                placeholder="Descreva os critérios de avaliação ou observações extras..."
                className="min-h-[120px] bg-slate-50/50"
                value={formData.observacao}
                onChange={(e) => setFormData(f => ({ ...f, observacao: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={saving} className="px-6">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="px-8 bg-primary hover:bg-primary/90">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Avaliação
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
