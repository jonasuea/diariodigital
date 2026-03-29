import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save, X, Search, Check } from 'lucide-react';
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
  serie?: string;
  classificacao?: string;
  ano?: string;
}

interface RegistroAulaData {
  unidadeTematica?: string;
  objetosConhecimento?: string[];
  habilidades?: string[];
  tempoAula?: string;
  status?: string;
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
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');
  const dataParams = searchParams.get('data');

  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openHabilidades, setOpenHabilidades] = useState(false);
  const [baseCurricular, setBaseCurricular] = useState<BaseCurricularData[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    unidadeTematica: "",
    objetosConhecimento: [] as string[],
    habilidades: [] as string[],
    tempoAula: "1º TEMPO",
    status: "Ministrado",
    observacao: ""
  });

  useEffect(() => {
    async function fetchTurmaAndRegistro() {
      if (!turmaId) return;
      try {
        const docRef = doc(db, 'turmas', turmaId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setTurma({ id: snapshot.id, ...snapshot.data() } as Turma);
        }

        // Buscar registro existente para esta data/turma/componente
        // Check infantil via serie/classificacao fields first, then fall back to nome
        const turmaData = snapshot.data();
        const turmaSerieFld = turmaData?.serie || turmaData?.classificacao || turmaData?.ano || "";
        const isInfTurma = snapshot.exists() && (
          SERIES_INFANTIL.some(s => turmaSerieFld?.toUpperCase().includes(s.toUpperCase())) ||
          SERIES_INFANTIL.some(s => turmaData?.nome?.toUpperCase().includes(s.toUpperCase()))
        );
        if ((componente || isInfTurma) && dataParams) {
          let q;
          if (isInfTurma) {
            q = query(
              collection(db, 'registros_aulas'),
              where('turma_id', '==', turmaId),
              where('data', '==', dataParams)
            );
          } else {
            q = query(
              collection(db, 'registros_aulas'),
              where('turma_id', '==', turmaId),
              where('componente', '==', componente),
              where('data', '==', dataParams)
            );
          }
          const snap = await getDocs(q);
          if (!snap.empty) {
            const existingDoc = snap.docs[0];
            const data = existingDoc.data() as RegistroAulaData;
            setEditingId(existingDoc.id);
            setFormData({
              unidadeTematica: data.unidadeTematica || "",
              objetosConhecimento: data.objetosConhecimento || [],
              habilidades: data.habilidades || [],
              tempoAula: data.tempoAula || "1º TEMPO",
              status: data.status || "Ministrado",
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
    fetchTurmaAndRegistro();
  }, [turmaId, componente, dataParams]);

  useEffect(() => {
    // Guard: turma is null on first render
    if (!turma) return;

    // Check if this is an Early Childhood class using the turma's serie field OR nome
    const turmaSerieField = turma.serie || turma.classificacao || turma.ano || "";
    const isInfantilFromField = SERIES_INFANTIL.some(s =>
      turmaSerieField.toUpperCase() === s.toUpperCase() ||
      turmaSerieField.toUpperCase().includes(s.toUpperCase())
    );
    const isInfantilFromNome = SERIES_INFANTIL.some(s => turma.nome.toUpperCase().includes(s.toUpperCase()));
    const isInfantil = isInfantilFromField || isInfantilFromNome;
    
    if (!componente && !isInfantil) return;

    async function fetchBaseCurricular() {
      setLoadingBase(true);
      try {
        // Extract the series: prefer turma.serie or turma.classificacao fields,
        // then try matching turma.nome against SERIES_INFANTIL,
        // finally fall back to regex for year-based grades
        const turmaSerieField = turma.serie || turma.classificacao || turma.ano || "";
        
        // Check if this turma is Early Childhood via the explicit serie field
        const infantilMatchFromField = SERIES_INFANTIL.find(s =>
          turmaSerieField.toUpperCase() === s.toUpperCase() ||
          turmaSerieField.toUpperCase().includes(s.toUpperCase())
        );
        
        // Fallback: check via turma.nome
        const infantilMatchFromNome = SERIES_INFANTIL.find(s => turma.nome.toUpperCase().includes(s.toUpperCase()));
        
        const resolvedInfantilMatch = infantilMatchFromField || infantilMatchFromNome;

        let serie = "";
        if (resolvedInfantilMatch) {
          serie = resolvedInfantilMatch;
        } else if (turmaSerieField) {
          // Use the turma's serie field directly for non-infantil grades
          const yearMatch = turmaSerieField.match(/\d+/);
          if (yearMatch) {
            serie = `${yearMatch[0]}º ANO`;
          } else {
            serie = turmaSerieField.toUpperCase();
          }
        } else {
          const serieMatch = turma.nome.match(/(\d+)º?\s?ANO/i);
          serie = serieMatch ? `${serieMatch[1]}º ANO` : "";
        }

        const effectiveInfantilMatch = resolvedInfantilMatch;

        if (!serie) {
          setLoadingBase(false);
          return;
        }

        let q;
        if (effectiveInfantilMatch) {
          q = query(
            collection(db, "base_curricular"),
            where("serie", "array-contains", serie)
          );
        } else {
          q = query(
            collection(db, "base_curricular"),
            where("serie", "array-contains", serie),
            where("componente", "==", componente)
          );
        }
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as BaseCurricularData) }));
        setBaseCurricular(data);
      } catch (error) {
        console.error("Erro ao buscar base curricular:", error);
      } finally {
        setLoadingBase(false);
      }
    }

    fetchBaseCurricular();
  }, [turma, componente]);

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
      // Filtrar apenas as habilidades dos objetos selecionados
      const relevantObjects = (b.objetos || []).filter((obj: { nome: string }) => 
        formData.objetosConhecimento.length === 0 || formData.objetosConhecimento.includes(obj.nome)
      );
      return relevantObjects.flatMap((obj: { habilidades?: { code: string; description: string }[] }) => obj.habilidades || []);
    }) as { code: string, description: string }[];

  // Helper for unique skills by code
  const uniqueHabilidades = Array.from(new Map(habilidadesDinamicas.map(h => [h.code, h])).values());

  const handleSave = async () => {
    const isInfantil = turma ? SERIES_INFANTIL.some(s => turma.nome.toUpperCase().includes(s.toUpperCase())) : false;
    if (!turmaId || (!componente && !isInfantil) || !dataParams) return;
    
    if (!isInfantil && (!formData.unidadeTematica || formData.objetosConhecimento.length === 0)) {
      toast.error("Por favor, preencha Unidade Temática e pelo menos um Objeto de Conhecimento.");
      return;
    }
    if (isInfantil && formData.objetosConhecimento.length === 0) {
      toast.error("Por favor, selecione pelo menos um Objeto de Conhecimento.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        turma_id: turmaId,
        data: dataParams,
        ...formData,
        updated_at: Timestamp.now()
      };
      
      if (componente) {
        payload.componente = componente;
      }

      if (editingId) {
        await updateDoc(doc(db, "registros_aulas", editingId), payload);
      } else {
        await addDoc(collection(db, "registros_aulas"), {
          ...payload,
          created_at: Timestamp.now()
        });
      }
      
      toast.success(editingId ? "Registro atualizado!" : "Registro salvo com sucesso!");
      navigate(-1);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar o registro.");
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
      
      // If we remove an object, we might need to filter out skills that no longer belong to any selected object
      // But for simplicity and flexibility, we usually keep them or let the user decide.
      // However, usually it's better to clear skills if they don't apply anymore or just let them stay.
      // Let's just update the objects for now to follow the user request style.
      return {
        ...prev,
        objetosConhecimento: newObjetos,
        // Optional: clear skills that are no longer valid? Might be annoying.
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
                  onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="bg-slate-50/50">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ministrado">Ministrado</SelectItem>
                    <SelectItem value="Não Ministrado">Não Ministrado</SelectItem>
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
