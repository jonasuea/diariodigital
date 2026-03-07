import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface StudentData {
  id: string;
  nome: string;
  matricula: string;
  data_nascimento?: string;
  rg?: string;
  cpf?: string;
  mae_nome?: string;
  pai_nome?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  turma_id: string;
  ano: number;
  responsavel_nome?: string;
  responsavel_rg?: string;
}

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano: number;
}

interface GenerateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: 'declaracaoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | 'declaracaoComparecimento' | 'termoUsoImagem' | 'termoAutorizacaoTrajeto';
  onGenerate: (data: any) => void;
}

export function GenerateDocumentDialog({ open, onOpenChange, title, type, onGenerate }: GenerateDocumentDialogProps) {
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [estudantes, setEstudantes] = useState<any[]>([]);
  const [selectedEstudante, setSelectedEstudante] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedParentType, setSelectedParentType] = useState<string>('responsavel');

  // Populate years
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setYears([currentYear, currentYear - 1, currentYear - 2]);
  }, []);

  // Fetch turmas when year changes
  useEffect(() => {
    if (open && selectedYear) {
      fetchTurmas();
    }
  }, [open, selectedYear]);

  // Fetch students when turma changes
  useEffect(() => {
    if (selectedTurma) {
      fetchEstudantes();
    } else {
      setEstudantes([]);
      setSelectedEstudante('');
    }
  }, [selectedTurma]);

  const fetchTurmas = async () => {
    setFetchingData(true);
    try {
      const q = query(
        collection(db, 'turmas'),
        where('ano', '==', parseInt(selectedYear)),
        orderBy('nome')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Turma));
      setTurmas(data);
      setSelectedTurma('');
    } catch (error) {
      console.error(error);
      toast.error('Sem permissão para buscar turmas');
    } finally {
      setFetchingData(false);
    }
  };

  const fetchEstudantes = async () => {
    setFetchingData(true);
    try {
      const q = query(
        collection(db, 'estudantes'),
        where('turma_id', '==', selectedTurma),
        orderBy('nome')
      );
      const snap = await getDocs(q);
      setEstudantes(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setSelectedEstudante('');
    } catch (error) {
      console.error(error);
      toast.error('Sem permissão para buscar estudantes');
    } finally {
      setFetchingData(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEstudante) {
      toast.error('Selecione um estudante');
      return;
    }

    setLoading(true);
    try {
      // Get full student data
      const studentDoc = await getDoc(doc(db, 'estudantes', selectedEstudante));
      if (!studentDoc.exists()) throw new Error('Estudante não encontrado');
      const studentData = { id: studentDoc.id, ...studentDoc.data() } as StudentData;

      // Get turma data
      const turma = turmas.find(t => t.id === selectedTurma);

      // Get grades if needed
      let notas: any[] = [];
      if (type === 'declaracaoMatricula') {
        const nq = query(
          collection(db, 'notas'),
          where('estudante_id', '==', selectedEstudante),
          where('ano', '==', parseInt(selectedYear))
        );
        const nSnap = await getDocs(nq);
        const notasExistentes = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // CRITICAL: Merge components from the class with existing grades
        const compsTurma = (turma as any)?.componentes || [];
        const componentesVistos = new Set<string>();

        // 1. Add existing grades
        notasExistentes.forEach((n: any) => {
          notas.push(n);
          componentesVistos.add(n.componente);
        });

        // 2. Add class components that don't have grades yet
        compsTurma.forEach((c: any) => {
          if (c.nome && !componentesVistos.has(c.nome)) {
            notas.push({
              id: `virtual_${c.nome}`,
              componente: c.nome,
              bimestre_1: null,
              bimestre_2: null,
              bimestre_3: null,
              bimestre_4: null,
              media_anual: null,
              situacao: 'Cursando'
            });
          }
        });

        // Sort by component name
        notas.sort((a, b) => a.componente.localeCompare(b.componente));
      }

      // Logic for Interessado (Parent/Guardian)
      let finalResponsavelNome = studentData.responsavel_nome || studentData.mae_nome || studentData.pai_nome;
      let finalResponsavelRg = studentData.responsavel_rg;

      if (type === 'declaracaoComparecimento' || type === 'termoUsoImagem' || type === 'termoAutorizacaoTrajeto') {
        if (selectedParentType === 'pai') {
          finalResponsavelNome = studentData.pai_nome;
          finalResponsavelRg = (studentData as any).pai_rg || ''; // If specific RG fields exist
        } else if (selectedParentType === 'mae') {
          finalResponsavelNome = studentData.mae_nome;
          finalResponsavelRg = (studentData as any).mae_rg || '';
        } else {
          finalResponsavelNome = studentData.responsavel_nome || studentData.mae_nome || studentData.pai_nome;
          finalResponsavelRg = studentData.responsavel_rg;
        }
      }

      onGenerate({
        studentData: {
          ...studentData,
          responsavel_nome: finalResponsavelNome,
          responsavel_rg: finalResponsavelRg
        },
        turma,
        notas,
        ano: selectedYear,
        type
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Sem permissão para preparar documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Ano */}
          <div className="space-y-2">
            <Label>Ano Letivo</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Turma */}
          <div className="space-y-2">
            <Label>Turma</Label>
            <Select value={selectedTurma} onValueChange={setSelectedTurma} disabled={fetchingData || turmas.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={fetchingData ? "Carregando..." : (turmas.length === 0 ? "Nenhuma turma" : "Selecione a turma")} />
              </SelectTrigger>
              <SelectContent>
                {turmas.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome} - {t.serie}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estudante */}
          <div className="space-y-2">
            <Label>Estudante</Label>
            <Select value={selectedEstudante} onValueChange={setSelectedEstudante} disabled={fetchingData || !selectedTurma || estudantes.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={fetchingData ? "Carregando..." : (estudantes.length === 0 ? "Nenhum estudante" : "Selecione o estudante")} />
              </SelectTrigger>
              <SelectContent>
                {estudantes.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interessado (Só para Declaração de Comparecimento, Termo de Imagem e Termo de Trajeto) */}
          {(type === 'declaracaoComparecimento' || type === 'termoUsoImagem' || type === 'termoAutorizacaoTrajeto') && (
            <div className="space-y-2">
              <Label>Interessado (Presente na Reunião)</Label>
              <Select value={selectedParentType} onValueChange={setSelectedParentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o interessado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                  <SelectItem value="mae">Mãe</SelectItem>
                  <SelectItem value="pai">Pai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || !selectedEstudante}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? 'Preparando...' : 'Gerar Documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
