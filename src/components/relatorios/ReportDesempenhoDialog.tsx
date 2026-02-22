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

interface Turma {
  id: string;
  nome: string;
  serie: string;
}

interface ReportDesempenhoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDesempenhoDialog({ open, onOpenChange }: ReportDesempenhoDialogProps) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');
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
      
      const estudantesQuery = query(collection(db, 'estudantes'), where('turma_id', '==', selectedTurma));
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const Estudantes = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const notasQuery = query(collection(db, 'notas'), where('turma_id', '==', selectedTurma), where('ano', '==', parseInt(selectedAno)));
      const notasSnapshot = await getDocs(notasQuery);
      const notas = notasSnapshot.docs.map(doc => doc.data());

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Desempenho', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Turma: ${turma?.nome || ''} - ${turma?.serie || ''}`, 20, 35);
      doc.text(`Ano Letivo: ${selectedAno}`, 20, 42);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 49);

      // Calcular médias por bimestre
      const mediaBim1 = notas?.length ? (notas.reduce((acc, n) => acc + (n.bimestre_1 || 0), 0) / notas.length).toFixed(1) : '-';
      const mediaBim2 = notas?.length ? (notas.reduce((acc, n) => acc + (n.bimestre_2 || 0), 0) / notas.length).toFixed(1) : '-';
      const mediaBim3 = notas?.length ? (notas.reduce((acc, n) => acc + (n.bimestre_3 || 0), 0) / notas.length).toFixed(1) : '-';
      const mediaBim4 = notas?.length ? (notas.reduce((acc, n) => acc + (n.bimestre_4 || 0), 0) / notas.length).toFixed(1) : '-';

      doc.setFontSize(14);
      doc.text('Evolução das Médias por Bimestre:', 20, 65);
      
      doc.setFontSize(11);
      doc.text(`1º Bimestre: ${mediaBim1}`, 30, 75);
      doc.text(`2º Bimestre: ${mediaBim2}`, 30, 82);
      doc.text(`3º Bimestre: ${mediaBim3}`, 30, 89);
      doc.text(`4º Bimestre: ${mediaBim4}`, 30, 96);

      if (Estudantes && Estudantes.length > 0) {
        const tableData = Estudantes.map(estudante => {
          const estudanteNotas = notas?.filter(n => n.estudante_id === estudante.id) || [];
          const b1 = estudanteNotas.length ? (estudanteNotas.reduce((acc, n) => acc + (n.bimestre_1 || 0), 0) / estudanteNotas.length).toFixed(1) : '-';
          const b2 = estudanteNotas.length ? (estudanteNotas.reduce((acc, n) => acc + (n.bimestre_2 || 0), 0) / estudanteNotas.length).toFixed(1) : '-';
          const b3 = estudanteNotas.length ? (estudanteNotas.reduce((acc, n) => acc + (n.bimestre_3 || 0), 0) / estudanteNotas.length).toFixed(1) : '-';
          const b4 = estudanteNotas.length ? (estudanteNotas.reduce((acc, n) => acc + (n.bimestre_4 || 0), 0) / estudanteNotas.length).toFixed(1) : '-';
          const media = estudanteNotas.length ? (estudanteNotas.reduce((acc, n) => acc + (n.media_anual || 0), 0) / estudanteNotas.length).toFixed(1) : '-';
          
          return [estudante.nome, b1, b2, b3, b4, media];
        });

        autoTable(doc, {
          startY: 110,
          head: [['Estudante', '1º Bim', '2º Bim', '3º Bim', '4º Bim', 'Média']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        });
      }

      doc.save(`relatorio-desempenho-${turma?.nome}-${selectedAno}.pdf`);
      toast.success('Relatório gerado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao gerar relatório');
      console.error(error)
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Desempenho</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Label className="w-16">Turma</Label>
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Sele..." />
              </SelectTrigger>
              <SelectContent>
                {turmas.map(turma => (
                  <SelectItem key={turma.id} value={turma.id.toString()}>
                    {turma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Label className="w-10">Ano</Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Sele..." />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            O relatório incluirá um gráfico de linhas mostrando o desempenho dos Estudantes por bimestre.
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
