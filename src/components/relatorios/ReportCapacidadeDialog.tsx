import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportCapacidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportCapacidadeDialog({ open, onOpenChange }: ReportCapacidadeDialogProps) {
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const generatePDF = async () => {
    if (!selectedAno) {
      toast.error('Selecione o ano');
      return;
    }

    setLoading(true);
    try {
      const turmasQuery = query(collection(db, 'turmas'), where('ano', '==', parseInt(selectedAno)));
      const turmasSnapshot = await getDocs(turmasQuery);
      const turmas = turmasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const alunosQuery = query(collection(db, 'alunos'), where('ano', '==', parseInt(selectedAno)), where('status', '==', 'Ativo'));
      const alunosSnapshot = await getDocs(alunosQuery);
      const alunos = alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Capacidade', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Ano Letivo: ${selectedAno}`, 20, 35);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);

      if (turmas && turmas.length > 0) {
        const tableData = turmas.map(turma => {
          const alunosTurma = alunos?.filter(a => a.turma_id === turma.id).length || 0;
          const capacidade = turma.capacidade || 30;
          const vagas = capacidade - alunosTurma;
          const ocupacao = ((alunosTurma / capacidade) * 100).toFixed(0);
          
          return [turma.nome, turma.serie, turma.turno, alunosTurma.toString(), capacidade.toString(), vagas.toString(), `${ocupacao}%`];
        });

        const totalAlunos = alunos?.length || 0;
        const totalCapacidade = turmas.reduce((acc, t) => acc + (t.capacidade || 30), 0);
        const totalVagas = totalCapacidade - totalAlunos;
        const ocupacaoGeral = totalCapacidade > 0 ? ((totalAlunos / totalCapacidade) * 100).toFixed(0) : '0';

        tableData.push(['TOTAL', '-', '-', totalAlunos.toString(), totalCapacidade.toString(), totalVagas.toString(), `${ocupacaoGeral}%`]);

        autoTable(doc, {
          startY: 55,
          head: [['Turma', 'Série', 'Turno', 'Alunos', 'Capacidade', 'Vagas', 'Ocupação']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
      }

      doc.save(`relatorio-capacidade-${selectedAno}.pdf`);
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
          <DialogTitle>Relatório de Capacidade</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Label className="w-10">Ano</Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            O relatório mostrará a ocupação de cada sala de aula, incluindo capacidade total, alunos matriculados e vagas disponíveis.
          </p>
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
