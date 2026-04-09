import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { avaliacaoRepo } from '@/repositories/AvaliacaoRepository';
import { planejamentoRepo } from '@/repositories/PlanejamentoRepository';
import { turmaRepo } from '@/repositories/CadastrosRepository';
import { toast } from 'sonner';
import { logActivity } from '@/lib/logger';
import { Loader2, ArrowLeft, Save, X, Search, Check, ClipboardList, Bot, FileEdit, PlusCircle, Pencil } from 'lucide-react';
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
import { useUserRole } from "@/hooks/useUserRole";

interface Turma {
  id: string;
  nome: string;
}

interface AvaliacaoSalva {
  id: string;
  titulo: string;
  tipo: string;
  valor: string;
  objetosConhecimento: string[];
  observacao: string;
}

const FORM_VAZIO = {
  titulo: "",
  tipo: "PROVA",
  valor: "",
  objetosConhecimento: [] as string[],
  observacao: ""
};

export default function RegistroAvaliacao() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');
  const dataParams = searchParams.get('data');
  const { escolaAtivaId } = useUserRole();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [objetosMinistrados, setObjetosMinistrados] = useState<string[]>([]);
  const [loadingObjetos, setLoadingObjetos] = useState(false);

  // Lista de avaliações já salvas para esse dia
  const [avaliacoesDoDia, setAvaliacoesDoDia] = useState<AvaliacaoSalva[]>([]);

  const [formData, setFormData] = useState({ ...FORM_VAZIO });

  // Busca todas as avaliações do dia para listagem (do cache local)
  const fetchAvaliacoesDoDia = useCallback(async () => {
    if (!turmaId || !componente || !dataParams) return;
    try {
      const lista = await avaliacaoRepo.getAvaliacoesByDia(turmaId, componente, dataParams);
      setAvaliacoesDoDia(lista);
    } catch (error) {
      console.error("Erro ao buscar avaliações do dia:", error);
    }
  }, [turmaId, componente, dataParams]);

  useEffect(() => {
    async function fetchInitialData() {
      if (!turmaId || !escolaAtivaId) return;
      try {
        // Seeding (apenas se online)
        await avaliacaoRepo.seedAvaliacoes(turmaId, escolaAtivaId);
        
        const turmaData = await turmaRepo.getById(turmaId);
        if (turmaData) {
          setTurma({ id: turmaId, ...turmaData } as Turma);
        }

        // Buscar objetos de conhecimento ministrados do banco local
        if (componente) {
          setLoadingObjetos(true);
          const registros = await planejamentoRepo.getRegistrosByTurma(turmaId, componente);
          const objetos = new Set<string>();
          registros.forEach(reg => {
            if (reg.status === 'Ministrado' && reg.objetosConhecimento) {
              reg.objetosConhecimento.forEach((obj: string) => objetos.add(obj));
            }
          });
          setObjetosMinistrados(Array.from(objetos).sort());
          setLoadingObjetos(false);
        }

        // Buscar todas as avaliações do dia do banco local
        await fetchAvaliacoesDoDia();

      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [turmaId, componente, dataParams, escolaAtivaId, fetchAvaliacoesDoDia]);

  // Carrega uma avaliação existente no formulário para edição
  const handleEditarAvaliacao = (av: AvaliacaoSalva) => {
    setEditingId(av.id);
    setFormData({
      titulo: av.titulo,
      tipo: av.tipo,
      valor: av.valor,
      objetosConhecimento: av.objetosConhecimento,
      observacao: av.observacao,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reseta o formulário para criar uma nova avaliação
  const handleNovaAvaliacao = () => {
    setEditingId(null);
    setFormData({ ...FORM_VAZIO });
  };

  const handleSave = async (redirectType?: 'manual' | 'ia') => {
    if (!turmaId || !componente || !dataParams) return;

    if (!formData.titulo || formData.objetosConhecimento.length === 0) {
      toast.error("Por favor, preencha o título e selecione pelo menos um objeto de conhecimento.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        turma_id: turmaId,
        componente,
        data: dataParams,
      };

      let savedId: string;
      if (editingId) {
        await avaliacaoRepo.updateAvaliacao(editingId, payload);
        savedId = editingId;
        toast.success("Avaliação atualizada!");
      } else {
        savedId = await avaliacaoRepo.saveAvaliacao(payload);
        toast.success("Avaliação salva com sucesso!");
      }

      if (redirectType === 'manual') {
        navigate(`/diario-digital/avaliacoes/${turmaId}/criar/${savedId}`);
      } else if (redirectType === 'ia') {
        navigate(`/diario-digital/avaliacoes/${turmaId}/criar-ia/${savedId}`);
      } else {
        await fetchAvaliacoesDoDia();
        setEditingId(null);
        setFormData({ ...FORM_VAZIO });
      }
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

            {/* Lista de avaliações salvas para esse dia */}
            {avaliacoesDoDia.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Avaliações criadas para este dia</p>
                    <p className="text-xs text-muted-foreground">Clique em uma avaliação para editá-la ou crie uma nova versão.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNovaAvaliacao}
                    className="shrink-0"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Nova Avaliação
                  </Button>
                </div>
                <div className="grid gap-2">
                  {avaliacoesDoDia.map((av, idx) => (
                    <div
                      key={av.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        editingId === av.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-slate-50/40 hover:bg-slate-100/60"
                      )}
                      onClick={() => handleEditarAvaliacao(av)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                          editingId === av.id ? "bg-primary text-primary-foreground" : "bg-slate-200 text-slate-600"
                        )}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{av.titulo || "Sem título"}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{av.tipo}</span>
                            {av.valor && (
                              <Badge variant="outline" className="text-xs h-5 px-1.5">Nota: {av.valor}</Badge>
                            )}
                            {av.objetosConhecimento.length > 0 && (
                              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                {av.objetosConhecimento.length} objeto{av.objetosConhecimento.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {editingId === av.id && (
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Editando</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); handleEditarAvaliacao(av); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/diario-digital/avaliacoes/${turmaId}/criar-ia/${av.id}`);
                          }}
                          title="Criar com IA"
                        >
                          <Bot className="h-3.5 w-3.5 text-purple-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/diario-digital/avaliacoes/${turmaId}/criar/${av.id}`);
                          }}
                          title="Criar manualmente"
                        >
                          <FileEdit className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t flex-wrap">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={saving} className="px-6">
                Cancelar
              </Button>
              <Button onClick={() => handleSave()} disabled={saving} className="px-6 bg-slate-600 hover:bg-slate-700">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Apenas Salvar
              </Button>
              <Button onClick={() => handleSave('manual')} disabled={saving} className="px-6 bg-blue-600 hover:bg-blue-700">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileEdit className="mr-2 h-4 w-4" />
                )}
                Criar Avaliação
              </Button>
              <Button onClick={() => handleSave('ia')} disabled={saving} className="px-6 bg-purple-600 hover:bg-purple-700">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="mr-2 h-4 w-4" />
                )}
                Criar com IA
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
