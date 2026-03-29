import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Save, Plus, Trash2, BookOpen, GraduationCap,
  Layers, Target, CheckCircle2, Loader2, Upload, Search, X, Check,
  Pencil, Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { db } from '@/lib/firebase';
import {
  collection, addDoc, serverTimestamp, getDocs,
  query, orderBy, deleteDoc, doc, writeBatch, updateDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SERIES = [
  "1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO",
  "6º ANO", "7º ANO", "8º ANO", "9º ANO"
];

const COMPONENTES = [
  "Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia",
  "Arte", "Educação Física", "Ensino Religioso", "Língua Inglesa"
];

interface ObjetoItem {
  nome: string;
  habilidades: { code: string; description: string }[];
}

interface BaseCurricularItem {
  id: string;
  serie: string[];
  componente: string;
  unidadeTematica: string;
  campoAtuacao?: string;
  objetos: ObjetoItem[];
}

export default function BaseCurricular() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BaseCurricularItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    serie: [] as string[],
    componente: "",
    campoAtuacao: "",
    unidadeTematica: "",
    objetos: [{ nome: "", habilidades: [{ code: "", description: "" }] }] as ObjetoItem[]
  });

  const fetchData = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, "base_curricular"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => {
        const docData = doc.data();
        // Migrações em tempo real
        const serie = Array.isArray(docData.serie) ? docData.serie : [docData.serie];

        // Migration: convert objectsConhecimento/habilidades to objetos array
        let objetos: ObjetoItem[] = [];
        if (Array.isArray(docData.objetos)) {
          objetos = docData.objetos;
        } else {
          const objetosConhecimento = Array.isArray(docData.objetosConhecimento)
            ? docData.objetosConhecimento
            : docData.objetoConhecimento
              ? [docData.objetoConhecimento]
              : [];

          const habilidades = Array.isArray(docData.habilidades) ? docData.habilidades : [];

          // If we have both, we don't know which skill goes to which object, 
          // so we'll put all skills in the first object as a fallback or split if possible.
          if (objetosConhecimento.length > 0) {
            objetos = objetosConhecimento.map((nome, idx) => ({
              nome,
              habilidades: idx === 0 ? habilidades : []
            }));
          }
        }

        return { id: doc.id, ...docData, serie, objetos } as BaseCurricularItem;
      });
      setData(items);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar a base curricular.");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addObjeto = () => {
    setFormData(prev => ({
      ...prev,
      objetos: [...prev.objetos, { nome: "", habilidades: [{ code: "", description: "" }] }]
    }));
  };

  const removeObjeto = (index: number) => {
    if (formData.objetos.length === 1) return;
    setFormData(prev => ({
      ...prev,
      objetos: prev.objetos.filter((_, i) => i !== index)
    }));
  };

  const updateObjeto = (index: number, value: string) => {
    setFormData(prev => {
      const newObjetos = [...prev.objetos];
      newObjetos[index] = { ...newObjetos[index], nome: value };
      return { ...prev, objetos: newObjetos };
    });
  };

  const addHabilidade = (objetoIndex: number) => {
    setFormData(prev => {
      const newObjetos = [...prev.objetos];
      newObjetos[objetoIndex].habilidades = [
        ...newObjetos[objetoIndex].habilidades,
        { code: "", description: "" }
      ];
      return { ...prev, objetos: newObjetos };
    });
  };

  const removeHabilidade = (objetoIndex: number, habIndex: number) => {
    if (formData.objetos[objetoIndex].habilidades.length === 1) return;
    setFormData(prev => {
      const newObjetos = [...prev.objetos];
      newObjetos[objetoIndex].habilidades = newObjetos[objetoIndex].habilidades.filter((_, i) => i !== habIndex);
      return { ...prev, objetos: newObjetos };
    });
  };

  const updateHabilidade = (objetoIndex: number, habIndex: number, field: 'code' | 'description', value: string) => {
    setFormData(prev => {
      const newObjetos = [...prev.objetos];
      const newHabs = [...newObjetos[objetoIndex].habilidades];
      newHabs[habIndex] = { ...newHabs[habIndex], [field]: value };
      newObjetos[objetoIndex] = { ...newObjetos[objetoIndex], habilidades: newHabs };
      return { ...prev, objetos: newObjetos };
    });
  };

  const handleEdit = (item: BaseCurricularItem) => {
    setEditingId(item.id);
    setFormData({
      serie: item.serie,
      componente: item.componente,
      campoAtuacao: item.campoAtuacao || "",
      unidadeTematica: item.unidadeTematica,
      objetos: item.objetos.map(o => ({
        nome: o.nome,
        habilidades: o.habilidades.map(h => ({ ...h }))
      }))
    });
    setViewMode('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      await deleteDoc(doc(db, "base_curricular", id));
      toast.success("Registro excluído com sucesso!");
      setData(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir registro.");
    }
  };

  const handleSave = async () => {
    if (formData.serie.length === 0 || !formData.componente) {
      toast.error("Por favor, preencha os campos obrigatórios (Série e Componente).");
      return;
    }

    const hasEmptyObjeto = formData.objetos.some(o => !o.nome.trim());
    if (hasEmptyObjeto) {
      toast.error("Por favor, preencha todos os objetos de conhecimento ou remova os vazios.");
      return;
    }

    const hasEmptyHabilidade = formData.objetos.some(o =>
      o.habilidades.some(h => !h.code || !h.description)
    );
    if (hasEmptyHabilidade) {
      toast.error("Por favor, preencha o código e a descrição de todas as habilidades.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "base_curricular", editingId), payload);
        toast.success("Registro atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "base_curricular"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success("Registro salvo com sucesso!");
      }

      setFormData({
        serie: [],
        componente: "",
        campoAtuacao: "",
        unidadeTematica: "",
        objetos: [{ nome: "", habilidades: [{ code: "", description: "" }] }]
      });
      setEditingId(null);
      fetchData();
      setViewMode('list');
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar o registro.");
    } finally {
      setLoading(false);
    }
  };

  const expandSeries = (serieStr: string): string[] => {
    if (!serieStr) return [];

    // Detect range like "1º ao 5º ano" (only for numbered years, not Early Childhood)
    const rangeMatch = serieStr.match(/(\d+)º?\s?(?:AO|à|a|–)\s?(\d+)º?/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      const result: string[] = [];
      for (let i = start; i <= end; i++) {
        result.push(`${i}º ANO`);
      }
      return result;
    }

    // Split by pipe (|) — the new multi-series separator used in exports.
    // Also accepts comma as fallback for legacy files.
    return serieStr.split(/[|,]/).map(s => {
      const trimmed = s.trim();
      const upperTrimmed = trimmed.toUpperCase();

      // Try exact case-insensitive match against any known series (including Early Childhood)
      const exactMatch = SERIES.find(serie => serie.toUpperCase() === upperTrimmed);
      if (exactMatch) return exactMatch;

      // Fallback: numeric shorthand like "1", "1º" -> "1º ANO"
      if (!upperTrimmed.includes("ANO") && /^\d+/.test(upperTrimmed)) {
        return `${upperTrimmed.match(/^\d+/)![0]}º ANO`;
      }

      return trimmed;
    }).filter(s => SERIES.includes(s));
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, ''),
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          
          // Grouping logic: Group by series, component, and unit
          const grouped = rows.reduce((acc: any, row: any) => {
            const rawClassificacao = row.classificacao || row['\ufeffclassificacao'] || '';
            const series = expandSeries(rawClassificacao);
            if (series.length === 0) return acc;

            const rawComponente = row.componente === "-" ? "" : (row.componente || "").trim();
            const rawUnidade = row.unidade_tematica === "-" ? "" : (row.unidade_tematica || "").trim();

            const key = `${series.sort().join(',')}-${rawComponente}-${rawUnidade}`;
            if (!acc[key]) {
              acc[key] = {
                serie: series,
                componente: rawComponente,
                unidadeTematica: rawUnidade,
                objetosMap: new Map<string, Set<{ code: string, description: string }>>() // nome -> Set of skills
              };
            }

            if (row.objeto_conhecimento) {
              const objNome = row.objeto_conhecimento.trim();
              if (!acc[key].objetosMap.has(objNome)) {
                acc[key].objetosMap.set(objNome, new Set());
              }

              if (row.habilidade) {
                // Split only on the FIRST colon to preserve dashes/colons in descriptions
                const colonIdx = row.habilidade.indexOf(':');
                const code = (colonIdx >= 0 ? row.habilidade.slice(0, colonIdx) : row.habilidade).trim();
                const description = (colonIdx >= 0 ? row.habilidade.slice(colonIdx + 1) : row.habilidade).trim();

                const existingHabs = acc[key].objetosMap.get(objNome);
                const alreadyHasCode = Array.from(existingHabs).some((h: any) => h.code === code);
                if (!alreadyHasCode) {
                  existingHabs.add({ code, description });
                }
              }
            }
            return acc;
          }, {});

          const items = Object.values(grouped);
          if (items.length === 0) {
            toast.error("Nenhum dado válido encontrado no CSV.");
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          // Batch chunking (Firestore limit is 500)
          for (let i = 0; i < items.length; i += 400) {
            const batch = writeBatch(db);
            items.slice(i, i + 400).forEach((item: any) => {
              const docRef = doc(collection(db, "base_curricular"));

              const objetos = Array.from(item.objetosMap.entries()).map(([nome, habilidadesSet]) => ({
                nome,
                habilidades: Array.from(habilidadesSet)
              }));

              batch.set(docRef, {
                serie: item.serie,
                componente: item.componente,
                unidadeTematica: item.unidadeTematica,
                objetos,
                createdAt: serverTimestamp()
              });
            });
            await batch.commit();
          }

          toast.success(`${items.length} registros importados e agrupados com sucesso!`);
          fetchData();
        } catch (error) {
          console.error("Erro na importação:", error);
          toast.error("Erro ao processar o arquivo CSV.");
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("Erro PapaParse:", error);
        toast.error("Erro ao ler o arquivo CSV.");
        setLoading(false);
      }
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const exportData = data.flatMap(item => 
      item.objetos.flatMap(obj => 
        obj.habilidades.map(hab => ({
          classificacao: item.serie.join(' | '),
          componente: item.componente || "-",
          unidade_tematica: item.unidadeTematica || "-",
          objeto_conhecimento: obj.nome,
          habilidade: `${hab.code}: ${hab.description}`
        }))
      )
    );

    const csv = Papa.unparse(exportData, { delimiter: ';' });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "base_curricular_modelo.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Base curricular exportada com sucesso!");
  };

  const toggleSerie = (serie: string) => {
    setFormData(prev => ({
      ...prev,
      serie: prev.serie.includes(serie)
        ? prev.serie.filter(s => s !== serie)
        : [...prev.serie, serie]
    }));
  };

  const filteredData = data.filter(item =>
    item.serie.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.componente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.unidadeTematica.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.objetos.some(o =>
      o.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.habilidades.some(h => h.code.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  return (
    <AppLayout title="Base Curricular (BNCC)">
      <div className="max-w-[1400px] mx-auto space-y-6 pb-12 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Base Curricular</h1>
              <p className="text-muted-foreground text-sm">Estruturação de competências e habilidades BNCC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'list' ? (
              <>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportCSV}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading || data.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button size="sm" onClick={() => {
                  setEditingId(null);
                  setFormData({
                    serie: [],
                    componente: "",
                    campoAtuacao: "",
                    unidadeTematica: "",
                    objetos: [{ nome: "", habilidades: [{ code: "", description: "" }] }]
                  });
                  setViewMode('form');
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Registro
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Lista
              </Button>
            )}
          </div>
        </div>

        {viewMode === 'list' ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Registros Curriculares</CardTitle>
                  <CardDescription>Visualize e gerencie a base curricular cadastrada.</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por série, componente..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {fetching ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando dados...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">Nenhum registro encontrado.</p>
                  {searchTerm && (
                    <Button variant="link" onClick={() => setSearchTerm("")}>Limpar busca</Button>
                  )}
                </div>
              ) : (
                <div className="relative overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[150px]">Série(s)</TableHead>
                        <TableHead className="w-[180px]">Componente</TableHead>
                        <TableHead className="w-[200px]">Unidade Temática</TableHead>
                        <TableHead className="min-w-[400px]">Objetos de Conhecimento</TableHead>
                        <TableHead className="w-[150px]">Habilidades</TableHead>
                        <TableHead className="w-[80px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.serie.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1 h-5 whitespace-nowrap">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{item.componente}</TableCell>
                          <TableCell className="text-xs">{item.unidadeTematica}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {item.objetos.slice(0, 2).map((obj, i) => (
                                <div key={i} className="flex flex-col">
                                  <span className="text-[10px] font-medium line-clamp-1">• {obj.nome}</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5 ml-2">
                                    {obj.habilidades.slice(0, 2).map((h, hi) => (
                                      <Badge key={hi} variant="secondary" className="text-[8px] px-1 h-3 leading-none">
                                        {h.code}
                                      </Badge>
                                    ))}
                                    {obj.habilidades.length > 2 && (
                                      <span className="text-[8px] text-muted-foreground">+{obj.habilidades.length - 2}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {item.objetos.length > 2 && (
                                <span className="text-[9px] text-primary italic font-medium">+{item.objetos.length - 2} mais objetos...</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {/* Summary of ALL codes in the item */}
                              {item.objetos.flatMap(o => o.habilidades).slice(0, 3).map((h, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] px-1 h-4">
                                  {h.code}
                                </Badge>
                              ))}
                              {item.objetos.reduce((acc, o) => acc + o.habilidades.length, 0) > 3 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{item.objetos.reduce((acc, o) => acc + o.habilidades.length, 0) - 3}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                onClick={() => handleEdit(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Contexto Geral
                  </CardTitle>
                  <CardDescription>Defina a quem se aplica este currículo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Série / Ano (Múltipla Seleção)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between bg-white border-primary/20 min-h-[40px] h-auto text-left font-normal"
                        >
                          <div className="flex flex-wrap gap-1 pr-2">
                            {formData.serie.length > 0 ? (
                              formData.serie.map((s, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] h-5">
                                  {s}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">Selecione as séries...</span>
                            )}
                          </div>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="p-2 space-y-1">
                          {SERIES.map((s) => (
                            <div
                              key={s}
                              className={cn(
                                "flex items-center space-x-2 p-2 rounded-sm cursor-pointer hover:bg-slate-100",
                                formData.serie.includes(s) && "bg-primary/5"
                              )}
                              onClick={() => toggleSerie(s)}
                            >
                              <Checkbox checked={formData.serie.includes(s)} />
                              <span className="text-sm flex-1">{s}</span>
                              {formData.serie.includes(s) && <Check className="h-4 w-4 text-primary" />}
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Componente Curricular</Label>
                    <Select value={formData.componente} onValueChange={(v) => setFormData(f => ({ ...f, componente: v }))}>
                      <SelectTrigger className="bg-white border-primary/20">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPONENTES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 shadow-sm">
                <CardHeader className="pb-3 border-b mb-6">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Estrutura Pedagógica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campo de Atuação (Opcional)</Label>
                      <Input
                        placeholder="Ex: Vida Cotidiana"
                        value={formData.campoAtuacao}
                        onChange={(e) => setFormData(f => ({ ...f, campoAtuacao: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade Temática</Label>
                      <Input
                        placeholder="Ex: Leitura/Escuta"
                        value={formData.unidadeTematica}
                        onChange={(e) => setFormData(f => ({ ...f, unidadeTematica: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-bold flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Objetos e Habilidades
                      </Label>
                    </div>

                    <div className="space-y-6">
                      {formData.objetos.map((obj, objetoIndex) => (
                        <div key={objetoIndex} className="p-4 rounded-xl border border-primary/10 bg-white shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-bold bg-primary/5 text-primary">
                              {objetoIndex + 1}
                            </Badge>
                            <div className="flex-1">
                              <Textarea
                                placeholder="Nome do Objeto de Conhecimento..."
                                className="font-semibold text-base min-h-[40px] py-2 bg-slate-50/30 border-slate-200 focus-visible:ring-primary/20"
                                value={obj.nome}
                                onChange={(e) => updateObjeto(objetoIndex, e.target.value)}
                              />
                            </div>
                            {formData.objetos.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => removeObjeto(objetoIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="pl-9 space-y-4 border-l-2 border-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Habilidades do Objeto</span>
                              <Button onClick={() => addHabilidade(objetoIndex)} variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/5">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Adicionar Habilidade
                              </Button>
                            </div>

                            {obj.habilidades.map((hab, habIndex) => (
                              <div key={habIndex} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-left-2">
                                <div className="md:col-span-3">
                                  <Input
                                    placeholder="Código (Ex: EF15LP01)"
                                    className="h-9 text-xs"
                                    value={hab.code}
                                    onChange={(e) => updateHabilidade(objetoIndex, habIndex, 'code', e.target.value.toUpperCase())}
                                  />
                                </div>
                                <div className="md:col-span-8">
                                  <Textarea
                                    placeholder="Descrição da habilidade..."
                                    className="min-h-[40px] text-xs py-2 bg-slate-50/30"
                                    value={hab.description}
                                    onChange={(e) => updateHabilidade(objetoIndex, habIndex, 'description', e.target.value)}
                                  />
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                  {obj.habilidades.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-300 hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => removeHabilidade(objetoIndex, habIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                    <Button variant="ghost" onClick={() => setViewMode('list')} disabled={loading}>
                      Cancelar
                    </Button>
                    <Button onClick={addObjeto} variant="outline" size="sm" className="bg-white hover:bg-primary/5 hover:text-primary border-primary/30">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Objeto de Conhecimento
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="px-10 h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Finalizar e Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 flex items-center gap-2 p-4 rounded-lg bg-orange-50 border border-orange-100 text-orange-800 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>
                <strong>Dica:</strong> Após salvar, você voltará para a lista geral para visualizar os novos dados.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
