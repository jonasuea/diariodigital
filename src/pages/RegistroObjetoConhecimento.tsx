import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { localDb } from '@/lib/db';
import { turmaRepo } from '@/repositories/CadastrosRepository';
import { planejamentoRepo } from '@/repositories/PlanejamentoRepository';
import { toast } from 'sonner';
import { logActivity } from '@/lib/logger';
import { Loader2, ArrowLeft, Save, X, Search, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
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
  serie?: string;
  classificacao?: string;
  ano?: string;
}

interface RegistroAulaData {
  unidadeTematica?: string;
  objetosConhecimento?: string[];
  habilidades?: string[];
  tempoAula?: string;
  status?: 'Ministrado' | 'Pendente' | 'Justificado';
  observacao?: string;
}

interface BaseCurricularData {
  unidadeTematica?: string;
  campoAtuacao?: string;
  objetos?: { nome: string; habilidades?: { code: string; description: string }[] }[];
}

const SERIES_INFANTIL = [
  "Crianças Bem Pequenas I",
  "Crianças Bem Pequenas II",
  "Crianças Pequenas I",
  "Crianças Pequenas II"
];

export default function RegistroObjetoConhecimento() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const searchParams = useSearchParams()[0];
  const componente = searchParams.get('componente');
  const dataParams = searchParams.get('data');
  const { escolaAtivaId, professorId: contextProfessorId } = useUserRole();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openHabilidades, setOpenHabilidades] = useState(false);
  const [baseCurricular, setBaseCurricular] = useState<BaseCurricularData[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registrosIniciais, setRegistrosIniciais] = useState<any[]>([]);
  const [unidadesTematicas, setUnidadesTematicas] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    unidadeTematica: "",
    objetosConhecimento: [] as string[],
    habilidades: [] as string[],
    tempoAula: "1º TEMPO",
    status: "Ministrado" as 'Ministrado' | 'Pendente' | 'Justificado',
    observacao: ""
  });

  async function loadData() {
    if (!turmaId || !escolaAtivaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (navigator.onLine) {
        try {
          const tData = await turmaRepo.getById(turmaId);
          if (tData) {
            await Promise.all([
              planejamentoRepo.seedBaseCurricular(tData.serie || '', componente || ''),
              planejamentoRepo.seedRegistros(turmaId, componente || '')
            ]);
          }
        } catch (e) {
          console.warn("[BNCC] Erro ao carregar base online", e);
        }
      }

      const turmaData = await turmaRepo.getById(turmaId);
      setTurma(turmaData || null);

      if (!turmaData) {
        return;
      }

      const registrosData = await planejamentoRepo.getRegistrosByTurma(turmaId, componente || '');
      setRegistrosIniciais(registrosData);

      const baseCurricularData = await planejamentoRepo.getBaseCurricularLocal(turmaData.serie || '', componente || '');
      setBaseCurricular(baseCurricularData);

      const isInfantilSerie = ["Crianças", "Bebês", "Infantil"].some(nome => turmaData.nome.includes(nome));
      if (!isInfantilSerie) {
        const unidades = Array.from(new Set(baseCurricularData.map(item => item.unidadeTematica).filter(Boolean))) as string[];
        setUnidadesTematicas(unidades);
      }

      if (dataParams) {
        const existing = registrosData.find(r => r.data === dataParams);
        if (existing) {
          setEditingId(existing.id);
          setFormData({
            unidadeTematica: existing.unidadeTematica || "",
            objetosConhecimento: existing.objetosConhecimento || [],
            habilidades: existing.habilidades || [],
            tempoAula: existing.tempoAula || "1º TEMPO",
            status: existing.status || "Ministrado",
            observacao: existing.observacao || ""
          });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [turmaId, componente, dataParams]);

  const turmaSerie = turma ? (turma.serie || turma.classificacao || turma.ano || turma.nome) : "";
  const isInfantil = SERIES_INFANTIL.some(s => turmaSerie.toUpperCase().includes(s.toUpperCase()));

  const unidadesDinamicas = Array.from(new Set(baseCurricular.map(b => b.unidadeTematica || b.campoAtuacao))).filter(Boolean) as string[];

  const objetosDinamicos = Array.from(new Set(
    baseCurricular
      .filter(b => isInfantil || !formData.unidadeTematica || (b.unidadeTematica === formData.unidadeTematica || b.campoAtuacao === formData.unidadeTematica))
      .flatMap(b => (b.objetos || []).map((o: { nome: string }) => o.nome))
  )).filter(Boolean) as string[];

  const habilidadesDinamicas = baseCurricular
    .filter(b => 
      (isInfantil || !formData.unidadeTematica || (b.unidadeTematica === formData.unidadeTematica || b.campoAtuacao === formData.unidadeTematica)) &&
      (formData.objetosConhecimento.length === 0 || (b.objetos || []).some((obj: { nome: string }) => formData.objetosConhecimento.includes(obj.nome)))
    )
    .flatMap(b => {
      const relevantObjects = (b.objetos || []).filter((obj: { nome: string }) => 
        formData.objetosConhecimento.length === 0 || formData.objetosConhecimento.includes(obj.nome)
      );
      return relevantObjects.flatMap((obj: { habilidades?: { code: string; description: string }[] }) => obj.habilidades || []);
    }) as { code: string, description: string }[];

  const uniqueHabilidades = Array.from(new Map(habilidadesDinamicas.map(h => [h.code, h])).values());

  const handleSave = async () => {
    if (!turmaId || (!componente && !isInfantil) || !dataParams) return;
    
    if (!isInfantil && (!formData.unidadeTematica || formData.objetosConhecimento.length === 0)) {
      return;
    }

    try {
      setSaving(true);
      const dataToSave = {
        ...formData,
        id: editingId || `${turmaId}-${dataParams}-${componente}`,
        escola_id: escolaAtivaId,
        turma_id: turmaId,
        componente: componente,
        data: dataParams,
        timestamp: new Date().toISOString()
      };

      await planejamentoRepo.save(dataToSave);

      toast.success("Registro de aula salvo offline!");
      await logActivity(editingId
        ? `atualizou o plano de aula de "${componente || 'Educação Infantil'}" na turma "${turma?.nome}" para o dia ${dataParams}.`
        : `registrou plano de aula de "${componente || 'Educação Infantil'}" na turma "${turma?.nome}" para o dia ${dataParams}.`
      );
      navigate(-1);
    } catch (error) {
      toast.error("Erro ao salvar offline");
      console.error(error);
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
      
      return {
        ...prev,
        objetosConhecimento: newObjetos,
      };
    });
  };

  const toggleHabilidade = (code: string) => {
    setFormData(prev => ({
      ...prev,
      habilidades: prev.habilidades.includes(code)
        ? prev.habilidades.filter(h => h !== code)
        : [...prev.habilidades, code]
    }));
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Objetos de Conhecimento</h1>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              Registre a aula para a turma <span className="font-semibold text-primary">{turma?.nome}</span>{componente && <> no componente <span className="font-semibold text-primary">{componente}</span></>}.
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
            <CardTitle className="text-lg font-semibold">{dataFormatada}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!isInfantil && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Unidade Temática</label>
                <Select
                  value={formData.unidadeTematica}
                  onValueChange={(v) => setFormData(f => ({ 
                    ...f, 
                    unidadeTematica: v,
                    objetosConhecimento: [], // Reset dependentes
                    habilidades: []
                  }))}
                >
                  <SelectTrigger className="bg-slate-50/50">
                    <SelectValue placeholder="Selecione a unidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingBase ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-xs">Carregando...</span>
                      </div>
                    ) : unidadesDinamicas.length > 0 ? (
                      unidadesDinamicas.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhum dado encontrado para esta série/componente</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div className={isInfantil ? "col-span-full space-y-3" : "space-y-3"}>
                <label className="text-sm font-medium">Objetos de Conhecimento</label>
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
                    >
                      {loadingBase ? "Carregando..." : "Selecionar objetos de conhecimento..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar objeto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum objeto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {objetosDinamicos.map((obj) => (
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
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Habilidades (BNCC)</label>
              <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-slate-50/30">
                {formData.habilidades.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nenhuma habilidade selecionada</span>
                ) : (
                  formData.habilidades.map((code) => (
                    <Badge key={code} variant="secondary" className="gap-1 pr-1">
                      {code}
                      <button
                        onClick={() => toggleHabilidade(code)}
                        className="p-0.5 hover:bg-slate-200 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              
              <Popover open={openHabilidades} onOpenChange={setOpenHabilidades}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openHabilidades}
                    className="w-full justify-between bg-white"
                  >
                    Pesquisar pela código da habilidade...
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite o código (ex: EF15LP01)..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma habilidade encontrada.</CommandEmpty>
                      <CommandGroup>
                        {uniqueHabilidades.map((hab: { code: string; description: string; id?: string }) => (
                          <CommandItem
                            key={hab.id || hab.code}
                            value={`${hab.code} ${hab.description}`}
                            onSelect={() => {
                              toggleHabilidade(hab.code);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.habilidades.includes(hab.code) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="text-sm">
                              <span className="font-bold">{hab.code}</span> - {hab.description}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tempo de aula</label>
                <Select
                  value={formData.tempoAula}
                  onValueChange={(v) => setFormData(f => ({ ...f, tempoAula: v }))}
                >
                  <SelectTrigger className="bg-slate-50/50">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1º TEMPO">1º TEMPO</SelectItem>
                    <SelectItem value="2º TEMPO">2º TEMPO</SelectItem>
                    <SelectItem value="3º TEMPO">3º TEMPO</SelectItem>
                    <SelectItem value="4º TEMPO">4º TEMPO</SelectItem>
                    <SelectItem value="5º TEMPO">5º TEMPO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData(f => ({ ...f, status: v as 'Ministrado' | 'Pendente' | 'Justificado' }))}
                >
                  <SelectTrigger className="bg-slate-50/50">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ministrado">Ministrado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Justificado">Justificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <div className="relative">
                <Textarea
                  placeholder="Digite observações sobre o desenvolvimento da aula..."
                  className="min-h-[120px] bg-slate-50/50"
                  value={formData.observacao}
                  onChange={(e) => setFormData(f => ({ ...f, observacao: e.target.value }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">*Todos os campos são importantes para o registro do diário.</p>
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
                    Salvar Registro
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
