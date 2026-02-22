import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportTransferenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportTransferenciasDialog({ open, onOpenChange }: ReportTransferenciasDialogProps) {
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
      const estudantesQuery1 = query(
        collection(db, 'estudantes'), 
        where('ano', '==', parseInt(selectedAno)), 
        where('status', '==', 'Transferido')
      );
      const estudantesQuery2 = query(
        collection(db, 'estudantes'), 
        where('ano', '==', parseInt(selectedAno)), 
        where('tipo_movimentacao', '==', 'Transferência')
      );

      const [snapshot1, snapshot2] = await Promise.all([getDocs(estudantesQuery1), getDocs(estudantesQuery2)]);
      
      const estudantesMap = new Map();
      snapshot1.docs.forEach(doc => estudantesMap.set(doc.id, { id: doc.id, ...doc.data() }));
      snapshot2.docs.forEach(doc => estudantesMap.set(doc.id, { id: doc.id, ...doc.data() }));
      
      const Estudantes = Array.from(estudantesMap.values()).sort((a,b) => b.data_movimentacao.localeCompare(a.data_movimentacao));

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Transferências', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Ano Letivo: ${selectedAno}`, 20, 35);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);

      const transferenciasRecebidas = Estudantes?.filter(a => a.tipo_movimentacao === 'Transferência') || [];
      const transferenciasSaidas = Estudantes?.filter(a => a.status === 'Transferido') || [];

      doc.setFontSize(14);
      doc.text('Resumo:', 20, 55);
      doc.setFontSize(11);
      doc.text(`• Transferências Recebidas: ${transferenciasRecebidas.length}`, 25, 65);
      doc.text(`• Transferências Realizadas: ${transferenciasSaidas.length}`, 25, 72);

      if (Estudantes && Estudantes.length > 0) {
        const tableData = Estudantes.map(estudante => {
          const tipo = estudante.status === 'Transferido' ? 'Saída' : 'Entrada';
          const origem = estudante.de_onde_veio || '-';
          const destino = estudante.para_onde_vai || '-';
          const data = estudante.data_movimentacao 
            ? new Date(estudante.data_movimentacao).toLocaleDateString('pt-BR') 
            : '-';
          
          return [estudante.matricula, estudante.nome, tipo, origem, destino, data];
        });

        autoTable(doc, {
          startY: 85,
          head: [['Matrícula', 'Nome', 'Tipo', 'Origem', 'Destino', 'Data']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        });
      } else {
        doc.text('Nenhuma transferência encontrada no período.', 20, 85);
      }

      doc.save(`relatorio-transferencias-${selectedAno}.pdf`);
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
          <DialogTitle>Relatório de Transferências</DialogTitle>
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
            O relatório mostrará todos os Estudantes transferidos no período, incluindo origem e destino.
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
