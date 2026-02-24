import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
}

const bimestres = [1, 2, 3, 4];

export default function ObjetosDeConhecimento() {
  const { user } = useAuth();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(false);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string | null>(null);

  const [conteudos, setConteudos] = useState<Record<number, { id: string | null; texto: string }>>({
    1: { id: null, texto: "" },
    2: { id: null, texto: "" },
    3: { id: null, texto: "" },
    4: { id: null, texto: "" },
  });

  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingConteudos, setLoadingConteudos] = useState(false);
  const [savingBimestre, setSavingBimestre] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTurmas() {
      try {
        const turmasQuery = query(collection(db, 'turmas'), orderBy('nome'));
        const turmasSnapshot = await getDocs(turmasQuery);
        const turmasData = turmasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
        setTurmas(turmasData);
      } catch (error) {
        console.error("Error fetching turmas: ", error);
        toast.error("Erro ao carregar as turmas.");
      } finally {
        setLoadingTurmas(false);
      }
    }
    fetchTurmas();
  }, []);

    useEffect(() => {
    if (turmaId) {
      setTurmaSelecionada(turmaId);
    }
  }, [turmaId]);

  useEffect(() => {
    if (!turmaSelecionada || !user) {
      setDisciplinas([]);
      setDisciplinaSelecionada(null);
      return;
    }

    async function fetchDisciplinas() {
      setLoadingDisciplinas(true);
      setDisciplinaSelecionada(null);
      try {
        const q = query(
          collection(db, 'professores_turmas'),
          where('turma_id', '==', turmaSelecionada),
          where('professor_id', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const disciplinasData = querySnapshot.docs.map(doc => doc.data().disciplina as string);
        const disciplinasUnicas = [...new Set(disciplinasData)];
        setDisciplinas(disciplinasUnicas.sort());
      } catch (error) {
        console.error("Error fetching disciplinas: ", error);
        toast.error("Erro ao carregar as disciplinas do professor.");
      } finally {
        setLoadingDisciplinas(false);
      }
    }

    fetchDisciplinas();
  }, [turmaSelecionada, user]);

  useEffect(() => {
    if (!turmaSelecionada || !disciplinaSelecionada) {
      setConteudos({ 1: { id: null, texto: "" }, 2: { id: null, texto: "" }, 3: { id: null, texto: "" }, 4: { id: null, texto: "" } });
      return;
    }

    async function fetchConteudos() {
      setLoadingConteudos(true);
      try {
        const q = query(collection(db, 'objetos_conhecimento'), where('turma_id', '==', turmaSelecionada), where('disciplina', '==', disciplinaSelecionada));
        const querySnapshot = await getDocs(q);
        
        const novosConteudos: Record<number, { id: string | null; texto: string }> = { 1: { id: null, texto: "" }, 2: { id: null, texto: "" }, 3: { id: null, texto: "" }, 4: { id: null, texto: "" } };

        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.bimestre >= 1 && data.bimestre <= 4) {
            novosConteudos[data.bimestre] = { id: doc.id, texto: data.conteudo };
          }
        });
        setConteudos(novosConteudos);
      } catch (error) {
        console.error("Error fetching conteudos: ", error);
        toast.error("Erro ao carregar os objetos de conhecimento.");
      } finally {
        setLoadingConteudos(false);
      }
    }

    fetchConteudos();
  }, [turmaSelecionada, disciplinaSelecionada]);

  const handleSave = async (bimestre: number) => {
    if (!turmaSelecionada || !disciplinaSelecionada) {
      toast.warning("Selecione uma turma e disciplina para salvar.");
      return;
    }
    
    setSavingBimestre(bimestre);
    const conteudoParaSalvar = conteudos[bimestre];

    try {
      if (conteudoParaSalvar.id) {
        const docRef = doc(db, 'objetos_conhecimento', conteudoParaSalvar.id);
        await updateDoc(docRef, { conteudo: conteudoParaSalvar.texto });
        toast.success(`Conteúdo do ${bimestre}º Bimestre atualizado!`);
      } else {
        const docRef = await addDoc(collection(db, 'objetos_conhecimento'), {
          turma_id: turmaSelecionada,
          disciplina: disciplinaSelecionada,
          bimestre: bimestre,
          conteudo: conteudoParaSalvar.texto,
          created_at: new Date(),
        });
        setConteudos(prev => ({ ...prev, [bimestre]: { ...prev[bimestre], id: docRef.id } }));
        toast.success(`Conteúdo do ${bimestre}º Bimestre salvo!`);
      }
    } catch (error) {
      console.error(`Error saving bimestre ${bimestre}: `, error);
      toast.error(`Erro ao salvar o conteúdo do ${bimestre}º Bimestre.`);
    } finally {
      setSavingBimestre(null);
    }
  };

  const handleConteudoChange = (bimestre: number, texto: string) => {
    setConteudos(prev => ({ ...prev, [bimestre]: { ...prev[bimestre], texto: texto } }));
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Objetos de Conhecimento</h1>
        <p className="text-muted-foreground">Planeje e registre os objetos de conhecimento e habilidades a serem trabalhados em cada bimestre.</p>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="turma" className="mb-2 block text-sm font-medium">Turma</label>
                <Select value={turmaSelecionada ?? ''} onValueChange={setTurmaSelecionada} disabled={loadingTurmas || !!turmaId}>
                  <SelectTrigger id="turma">
                    <SelectValue placeholder={loadingTurmas ? "Carregando turmas..." : "Selecione a turma"} />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                                <label htmlFor="disciplina" className="mb-2 block text-sm font-medium">Disciplina</label>
                <Select 
                  onValueChange={setDisciplinaSelecionada} 
                  disabled={!turmaSelecionada || loadingDisciplinas}
                  value={disciplinaSelecionada ?? ''}
                >
                  <SelectTrigger id="disciplina">
                    <SelectValue placeholder={loadingDisciplinas ? "Carregando..." : "Selecione a disciplina"} />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinas.map((disciplina) => (
                      <SelectItem key={disciplina} value={disciplina}>{disciplina}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingConteudos ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : turmaSelecionada && disciplinaSelecionada ? (
              <Accordion type="single" collapsible className="w-full">
                {bimestres.map((bimestre) => (
                  <AccordionItem key={bimestre} value={`bimestre-${bimestre}`}>
                    <AccordionTrigger>{bimestre}º Bimestre</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <Textarea
                          placeholder={`Digite os objetos de conhecimento e habilidades para o ${bimestre}º bimestre...`}
                          className="min-h-[200px]"
                          value={conteudos[bimestre].texto}
                          onChange={(e) => handleConteudoChange(bimestre, e.target.value)}
                          disabled={savingBimestre !== null}
                        />
                        <Button onClick={() => handleSave(bimestre)} disabled={savingBimestre !== null}>
                          {savingBimestre === bimestre ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {savingBimestre === bimestre ? 'Salvando...' : `Salvar ${bimestre}º Bimestre`}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-md border-2 border-dashed">
                <p className="text-muted-foreground">Selecione uma turma e uma disciplina para visualizar ou registrar os conteúdos.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}