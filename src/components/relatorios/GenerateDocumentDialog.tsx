import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  rg: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  pai_nome: string | null;
  mae_nome: string | null;
  turma_id: string | null;
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
  template: string;
}

export function GenerateDocumentDialog({ open, onOpenChange, title, template }: GenerateDocumentDialogProps) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      const alunosQuery = query(collection(db, 'alunos'), where('status', '==', 'Ativo'), orderBy('nome'));
      const turmasQuery = query(collection(db, 'turmas'), orderBy('nome'));

      const [alunosSnapshot, turmasSnapshot] = await Promise.all([
        getDocs(alunosQuery),
        getDocs(turmasQuery),
      ]);
      
      setAlunos(alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aluno)));
      setTurmas(turmasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma)));
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const generatePDF = async () => {
    if (!selectedAluno) {
      toast.error('Selecione um aluno');
      return;
    }

    setLoading(true);
    try {
      const aluno = alunos.find(a => a.id === selectedAluno);
      const turma = turmas.find(t => t.id === aluno?.turma_id);

      if (!aluno) {
        toast.error('Aluno não encontrado');
        setLoading(false);
        return;
      }

      let content = template
        .replace(/\[NOME_ALUNO\]/g, aluno.nome || '')
        .replace(/\[RG_ALUNO\]/g, aluno.rg || 'Não informado')
        .replace(/\[CPF_ALUNO\]/g, aluno.cpf || 'Não informado')
        .replace(/\[TURMA\]/g, turma?.nome || '')
        .replace(/\[ANO_SERIE\]/g, turma?.serie || '')
        .replace(/\[ANO_LETIVO\]/g, turma?.ano?.toString() || new Date().getFullYear().toString())
        .replace(/\[TURNO\]/g, turma?.turno || '')
        .replace(/\[DATA\]/g, new Date().toLocaleDateString('pt-BR'))
        .replace(/\[CIDADE\]/g, 'Cidade')
        .replace(/\[NOME_DIRETOR\]/g, 'Diretor(a)')
        .replace(/\[NOME_RESPONSAVEL\]/g, aluno.mae_nome || aluno.pai_nome || 'Responsável')
        .replace(/\[DATA_NASCIMENTO\]/g, aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR') : '')
        .replace(/\[NOME_PAI\]/g, aluno.pai_nome || 'Não informado')
        .replace(/\[NOME_MAE\]/g, aluno.mae_nome || 'Não informado')
        .replace(/\[NATURALIDADE\]/g, aluno.naturalidade || 'Não informado')
        .replace(/\[NIVEL_ENSINO\]/g, 'Fundamental');

      const doc = new jsPDF();
      
      doc.setFontSize(12);
      
      const lines = doc.splitTextToSize(content, 170);
      let y = 30;
      
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
      });

      doc.save(`${title.toLowerCase().replace(/ /g, '-')}-${aluno.nome}.pdf`);
      toast.success('Documento gerado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao gerar documento');
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
          <div className="flex items-center gap-4">
            <Label className="w-16">Aluno</Label>
            <Select value={selectedAluno} onValueChange={setSelectedAluno}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione o aluno" />
              </SelectTrigger>
              <SelectContent>
                {alunos.map(aluno => (
                  <SelectItem key={aluno.id} value={aluno.id.toString()}>
                    {aluno.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={generatePDF} disabled={loading}>
            {loading ? 'Gerando...' : 'Gerar Documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
