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

interface ReportMatriculasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportMatriculasDialog({ open, onOpenChange }: ReportMatriculasDialogProps) {
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

      const estudantesQuery = query(collection(db, 'estudantes'), where('ano', '==', parseInt(selectedAno)));
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const Estudantes = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Matrículas', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Ano Letivo: ${selectedAno}`, 20, 35);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);

      // Estatísticas gerais
      const totalestudantes = Estudantes?.length || 0;
      const novasMatriculas = Estudantes?.filter(a => !a.tipo_movimentacao || a.tipo_movimentacao === 'Nova Matrícula').length || 0;
      const transferencias = Estudantes?.filter(a => a.tipo_movimentacao === 'Transferência').length || 0;
      const evasao = Estudantes?.filter(a => a.status === 'Transferido' || a.status === 'Desistente').length || 0;

      doc.setFontSize(14);
      doc.text('Resumo Geral:', 20, 55);
      
      doc.setFontSize(11);
      doc.text(`• Total de Matrículas: ${totalestudantes}`, 25, 65);
      doc.text(`• Novas Matrículas: ${novasMatriculas}`, 25, 72);
      doc.text(`• Transferências Recebidas: ${transferencias}`, 25, 79);
      doc.text(`• Evasão/Transferências: ${evasao}`, 25, 86);

      if (turmas && turmas.length > 0) {
        const tableData = turmas.map(turma => {
          const estudantesTurma = Estudantes?.filter(a => a.turma_id === turma.id).length || 0;
          const capacidade = turma.capacidade || 30;
          const ocupacao = capacidade > 0 ? ((estudantesTurma / capacidade) * 100).toFixed(0) : '0';
          
          return [turma.nome, turma.serie, estudantesTurma.toString(), capacidade.toString(), `${ocupacao}%`];
        });

        autoTable(doc, {
          startY: 100,
          head: [['Turma', 'Série', 'Estudantes', 'Capacidade', 'Ocupação']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        });
      }

      doc.save(`relatorio-matriculas-${selectedAno}.pdf`);
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
          <DialogTitle>Relatório de Matrículas</DialogTitle>
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

          <div className="text-sm text-muted-foreground space-y-1">
            <p>O relatório incluirá:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Turmas e quantidade de matrículas automáticas</li>
              <li>Quantidade de novas matrículas</li>
              <li>Quantidade de transferências</li>
              <li>Quantidade de evasão</li>
            </ul>
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
