import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
}

const bimestres = [1, 2, 3, 4];

export default function ObjetosDeConhecimento() {
  const { turmaId } = useParams<{ turmaId?: string }>();
  const [searchParams] = useSearchParams();
  const componente = searchParams.get('componente');

  const [turma, setTurma] = useState<Turma | null>(null);
  const [conteudos, setConteudos] = useState<Record<number, { id: string | null; texto: string }>>({
    1: { id: null, texto: "" },
    2: { id: null, texto: "" },
    3: { id: null, texto: "" },
    4: { id: null, texto: "" },
  });

  const [loading, setLoading] = useState(true);
  const [savingBimestre, setSavingBimestre] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTurmaEConteudos() {
      if (!turmaId || !componente) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        // Fetch Turma
        const turmaDocRef = doc(db, 'turmas', turmaId);
        const turmaDoc = await getDoc(turmaDocRef);
        if (turmaDoc.exists()) {
          setTurma({ id: turmaDoc.id, ...turmaDoc.data() } as Turma);
        } else {
          toast.error("Turma não encontrada.");
        }

        // Fetch Conteudos
        const q = query(
          collection(db, 'objetos_conhecimento'),
          where('turma_id', '==', turmaId),
          where('componente', '==', componente)
        );
        const querySnapshot = await getDocs(q);

        const novosConteudos: Record<number, { id: string | null; texto: string }> = {
          1: { id: null, texto: "" }, 2: { id: null, texto: "" }, 3: { id: null, texto: "" }, 4: { id: null, texto: "" }
        };

        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.bimestre >= 1 && data.bimestre <= 4) {
            novosConteudos[data.bimestre] = { id: doc.id, texto: data.conteudo };
          }
        });
        setConteudos(novosConteudos);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error("Erro ao carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchTurmaEConteudos();
  }, [turmaId, componente]);

  const handleSave = async (bimestre: number) => {
    if (!turmaId || !componente) {
      toast.warning("Turma ou componente não identificados.");
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
          turma_id: turmaId,
          componente: componente,
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
        <p className="text-muted-foreground">
          Planeje e registre os objetos de conhecimento para a turma <span className="font-semibold text-primary">{turma?.nome}</span> no componente <span className="font-semibold text-primary">{componente}</span>.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Conteúdos Bimestrais</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : turmaId && componente ? (
              <Accordion type="single" collapsible className="w-full" defaultValue="bimestre-1">
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
                <p className="text-muted-foreground">Não foi possível carregar os dados. Verifique se a turma e o componente foram selecionados corretamente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}