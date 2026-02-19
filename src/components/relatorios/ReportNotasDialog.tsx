import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Turma {
  id: string;
  nome: string;
  serie: string;
  ano: number;
}

interface ReportNotasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportNotasDialog({ open, onOpenChange }: ReportNotasDialogProps) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [incluirAtaFinal, setIncluirAtaFinal] = useState(false);
  const [loading, setLoading] = useState(false);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchTurmas();
  }, []);

  const fetchTurmas = async () => {
    try {
        const q = query(collection(db, 'turmas'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
        setTurmas(turmasData);
    } catch (error) {
        console.error("Error fetching turmas: ", error);
    }
  };

  const generatePDF = async () => {
    if (!selectedTurma || !selectedAno) {
      toast.error('Selecione a turma e o ano');
      return;
    }

    setLoading(true);
    try {
      const turma = turmas.find(t => t.id === selectedTurma);
      
      const alunosQuery = query(collection(db, 'alunos'), where('turma_id', '==', selectedTurma), orderBy('nome'));
      const alunosSnapshot = await getDocs(alunosQuery);
      const alunos = alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const notasQuery = query(collection(db, 'notas'), where('turma_id', '==', selectedTurma), where('ano', '==', parseInt(selectedAno)));
      const notasSnapshot = await getDocs(notasQuery);
      const notas = notasSnapshot.docs.map(doc => doc.data());

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Notas por Turma', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Turma: ${turma?.nome || ''} - ${turma?.serie || ''}`, 20, 35);
      doc.text(`Ano Letivo: ${selectedAno}`, 20, 42);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 49);

      if (alunos && alunos.length > 0) {
        const tableData = alunos.map(aluno => {
          const alunoNotas = notas?.filter(n => n.aluno_id === aluno.id) || [];
          const mediaGeral = alunoNotas.length > 0
            ? (alunoNotas.reduce((acc, n) => acc + (n.media_anual || 0), 0) / alunoNotas.length).toFixed(1)
            : '-';
          
          return [
            aluno.matricula,
            aluno.nome,
            mediaGeral,
            incluirAtaFinal ? (parseFloat(mediaGeral as string) >= 6 ? 'Aprovado' : 'Reprovado') : '-'
          ];
        });

        autoTable(doc, {
          startY: 60,
          head: [['Matrícula', 'Nome', 'Média Geral', incluirAtaFinal ? 'Situação' : '']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        });
      } else {
        doc.text('Nenhum aluno encontrado nesta turma.', 20, 60);
      }

      doc.save(`relatorio-notas-${turma?.nome}-${selectedAno}.pdf`);
      toast.success('Relatório gerado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao gerar relatório');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Notas por Turma</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Label className="w-16">Turma</Label>
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {turmas.map(turma => (
                  <SelectItem key={turma.id} value={turma.id.toString()}>
                    {turma.nome} - {turma.serie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="w-16">Ano</Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox 
              id="ataFinal" 
              checked={incluirAtaFinal} 
              onCheckedChange={(checked) => setIncluirAtaFinal(checked as boolean)} 
            />
            <Label htmlFor="ataFinal" className="text-sm text-muted-foreground">
              Incluir Ata Final (apenas se todas as notas estiverem lançadas)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={generatePDF} disabled={loading}>
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
