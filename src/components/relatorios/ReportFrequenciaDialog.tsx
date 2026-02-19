import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
}

interface ReportFrequenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const meses = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function ReportFrequenciaDialog({ open, onOpenChange }: ReportFrequenciaDialogProps) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState<string>('');
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
    if (!selectedTurma || !selectedMes || !selectedAno) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const turma = turmas.find(t => t.id === selectedTurma);
      const mesNome = meses.find(m => m.value === selectedMes)?.label;
      
      const startDate = `${selectedAno}-${selectedMes.padStart(2, '0')}-01`;
      const endDate = `${selectedAno}-${selectedMes.padStart(2, '0')}-31`;

      const alunosQuery = query(collection(db, 'alunos'), where('turma_id', '==', selectedTurma), orderBy('nome'));
      const alunosSnapshot = await getDocs(alunosQuery);
      const alunos = alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const frequenciaQuery = query(
        collection(db, 'frequencia'), 
        where('turma_id', '==', selectedTurma),
        where('data', '>=', startDate),
        where('data', '<=', endDate)
      );
      const frequenciaSnapshot = await getDocs(frequenciaQuery);
      const frequencias = frequenciaSnapshot.docs.map(doc => doc.data());

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório de Frequência', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Turma: ${turma?.nome || ''} - ${turma?.serie || ''}`, 20, 35);
      doc.text(`Período: ${mesNome}/${selectedAno}`, 20, 42);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 49);

      if (alunos && alunos.length > 0) {
        const tableData = alunos.map(aluno => {
          const alunoFreq = frequencias?.filter(f => f.aluno_id === aluno.id) || [];
          const presencas = alunoFreq.filter(f => f.status === 'presente').length;
          const faltas = alunoFreq.filter(f => f.status === 'ausente' || f.status === 'faltou').length;
          const total = presencas + faltas;
          const percentual = total > 0 ? ((presencas / total) * 100).toFixed(1) : '-';
          
          return [aluno.matricula, aluno.nome, presencas.toString(), faltas.toString(), `${percentual}%`];
        });

        autoTable(doc, {
          startY: 60,
          head: [['Matrícula', 'Nome', 'Presenças', 'Faltas', '% Frequência']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        });
      } else {
        doc.text('Nenhum aluno encontrado nesta turma.', 20, 60);
      }

      doc.save(`relatorio-frequencia-${turma?.nome}-${mesNome}-${selectedAno}.pdf`);
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
          <DialogTitle>Relatório de Frequência</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Label className="w-16">Turma</Label>
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione a turma" />
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
            <Label className="w-16">Mês</Label>
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <Label className="w-16">Ano</Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
