import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Printer, X, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { printElement } from '@/lib/print-utils';

interface Turma {
  id: string;
  nome: string;
  serie: string;
  ano: number;
}

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
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
  const printRef = useRef<HTMLDivElement>(null);
  const { escolaAtivaId } = useUserRole();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
  const [selectedMes, setSelectedMes] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());

  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [frequencias, setFrequencias] = useState<any[]>([]);
  const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
  const [loading, setLoading] = useState(false);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (open && escolaAtivaId) {
      fetchEscolaInfo();
    } else if (!open) {
      setSelectedTurmaId('');
      setCurrentTurma(null);
      setSelectedMes('');
      setEstudantes([]);
      setFrequencias([]);
    }
  }, [open, escolaAtivaId]);

  useEffect(() => {
    if (open && escolaAtivaId && selectedAno) {
      fetchTurmas(selectedAno);
    }
  }, [selectedAno, open, escolaAtivaId]);

  useEffect(() => {
    if (selectedTurmaId && turmas.length > 0) {
      const t = turmas.find(t => t.id === selectedTurmaId);
      if (t) {
        setCurrentTurma(t);
      }
    } else {
      setCurrentTurma(null);
    }
  }, [selectedTurmaId, turmas]);

  useEffect(() => {
    if (currentTurma && selectedMes && selectedAno) {
      fetchData(currentTurma.id, selectedMes, selectedAno);
    } else {
      setEstudantes([]);
      setFrequencias([]);
    }
  }, [currentTurma, selectedMes, selectedAno]);

  const fetchEscolaInfo = async () => {
    if (!escolaAtivaId) return;
    try {
      const escolaSnap = await getDoc(doc(db, 'escolas', escolaAtivaId));
      if (escolaSnap.exists()) {
        const d = escolaSnap.data();
        setEscolaInfo({
          nome: d.nome || '',
          inep: d.inep || '',
          decreto: d.decreto_criacao || ''
        });
      }
    } catch (error) {
      console.error("Error fetching escola info:", error);
    }
  };

  const fetchTurmas = async (ano: string) => {
    if (!escolaAtivaId) return;
    try {
      const q = query(
        collection(db, 'turmas'),
        where('escola_id', '==', escolaAtivaId),
        where('ano', '==', parseInt(ano)),
        orderBy('nome')
      );
      const querySnapshot = await getDocs(q);
      const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
      setTurmas(turmasData);

      // se a turma selecionada não estiver na lista (ex: mudou de ano), resetar
      if (selectedTurmaId && !turmasData.some(t => t.id === selectedTurmaId)) {
        setSelectedTurmaId('');
        setCurrentTurma(null);
      }
    } catch (error) {
      console.error("Error fetching turmas: ", error);
      toast.error('Sem permissão para buscar turmas');
    }
  };

  const fetchData = async (turmaId: string, mes: string, ano: string) => {
    setLoading(true);
    try {
      const startDate = `${ano}-${mes.padStart(2, '0')}-01`;
      const endDate = `${ano}-${mes.padStart(2, '0')}-31`;

      const estudantesQuery = query(
        collection(db, 'estudantes'),
        where('turma_id', '==', turmaId),
        orderBy('nome')
      );
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const estudantesData = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante));
      setEstudantes(estudantesData);

      const frequenciaQuery = query(
        collection(db, 'frequencias'),
        where('turma_id', '==', turmaId),
        where('data', '>=', startDate),
        where('data', '<=', endDate)
      );
      const frequenciaSnapshot = await getDocs(frequenciaQuery);
      const frequenciasData = frequenciaSnapshot.docs.map(doc => doc.data());
      setFrequencias(frequenciasData);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error('Sem permissão para carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current);
    }
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const mesLabel = meses.find(m => m.value === selectedMes)?.label || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl print:overflow-visible print:max-h-none print:w-auto print:max-w-none [&>button]:hidden">
        {/* Controls - Visible only in app, hidden during print */}
        <div className="p-6 border-b bg-gray-50 no-print flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Label htmlFor="select-turma" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Selecionar Turma
            </Label>
            <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId} disabled={turmas.length === 0}>
              <SelectTrigger id="select-turma">
                <SelectValue placeholder={turmas.length === 0 ? "Nenhuma turma neste ano" : "Selecione a turma..."} />
              </SelectTrigger>
              <SelectContent>
                {turmas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} - {t.serie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <Label htmlFor="select-mes" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Mês
            </Label>
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger id="select-mes">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <Label htmlFor="select-ano" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Ano
            </Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger id="select-ano">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && <Loader2 className="h-5 w-5 animate-spin text-primary mb-2 ml-auto" />}
        </div>

        <div ref={printRef} className="print-container p-8 bg-white text-black">
          {/* Header */}
          <div className="border border-black p-4 mb-6">
            <h1 className="text-center font-bold text-xl uppercase mb-4 border-b border-black pb-2">
              {escolaInfo.nome || 'NOME DA ESCOLA'}
            </h1>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">INEP:</span>
                <span>{escolaInfo.inep}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DECRETO:</span>
                <span>{escolaInfo.decreto}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">SÉRIE:</span>
                <span>{currentTurma?.serie || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">TURMA:</span>
                <span>{currentTurma?.nome || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">PERÍODO:</span>
                <span>{selectedMes && selectedAno ? `${mesLabel}/${selectedAno}` : '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                <span>{dataAtual}</span>
              </div>
            </div>
            <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg uppercase">
              Relatório de Frequência
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-10 flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Carregando dados...</p>
            </div>
          ) : (
            <table className="w-full border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-gray-50 border border-black">
                  <th className="border-r border-black p-2 w-12 text-center whitespace-nowrap">Nº</th>
                  <th className="border-r border-black p-2 w-24 text-center whitespace-nowrap">MATRÍCULA</th>
                  <th className="border-r border-black p-2 text-left whitespace-nowrap">NOME DO(A) ESTUDANTE:</th>
                  <th className="border-r border-black p-2 w-24 text-center">PRESENÇAS</th>
                  <th className="border-r border-black p-2 w-24 text-center">FALTAS</th>
                  <th className="p-2 w-28 text-center text-xs">% FREQUÊNCIA</th>
                </tr>
              </thead>
              <tbody className="border border-black">
                {estudantes.map((estudante, index) => {
                  const estudanteFreq = frequencias.filter(f => f.estudante_id === estudante.id);
                  const presencas = estudanteFreq.filter(f => f.status === 'presente').length;
                  const faltas = estudanteFreq.filter(f => f.status === 'ausente' || f.status === 'faltou').length;
                  const total = presencas + faltas;
                  const percentual = total > 0 ? ((presencas / total) * 100).toFixed(1) : '-';

                  return (
                    <tr key={estudante.id} className="hover:bg-gray-50/50 border-b border-black">
                      <td className="border-r border-black py-0.5 px-2 text-center whitespace-nowrap">{String(index + 1).padStart(2, '0')}</td>
                      <td className="border-r border-black py-0.5 px-2 text-center whitespace-nowrap">{estudante.matricula || '-'}</td>
                      <td className="border-r border-black py-0.5 px-2 uppercase whitespace-nowrap">{estudante.nome}</td>
                      <td className="border-r border-black py-0.5 px-2 text-center font-medium">{presencas > 0 ? presencas : '-'}</td>
                      <td className="border-r border-black py-0.5 px-2 text-center font-medium">{faltas > 0 ? faltas : '-'}</td>
                      <td className="py-0.5 px-2 text-center font-medium">
                        {percentual !== '-' ? `${percentual}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
                {(!currentTurma || !selectedMes || !selectedAno) && !loading && (
                  <tr>
                    <td colSpan={6} className="border border-black p-8 text-center text-muted-foreground italic">
                      Selecione uma turma, mês e ano acima para gerar o relatório.
                    </td>
                  </tr>
                )}
                {currentTurma && selectedMes && selectedAno && estudantes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="border border-black p-4 text-center text-muted-foreground">
                      Nenhum estudante encontrado nesta turma.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="mt-8 text-right text-xs text-gray-500 last-page-only">
            Página 1
          </div>
        </div>

        {/* Action Buttons (Sticky at bottom) */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3 no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
          <Button onClick={handlePrint} disabled={!currentTurma || !selectedMes || !selectedAno || loading || estudantes.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4" /> Imprimir Relatório
          </Button>
        </div>

      </DialogContent>
    </Dialog >
  );
}
