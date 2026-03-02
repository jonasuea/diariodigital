import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Printer, X, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { printContainer } from '@/lib/print-utils';

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano: number;
  capacidade?: number;
}

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
}

interface ReportMatriculasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportMatriculasDialog({ open, onOpenChange }: ReportMatriculasDialogProps) {
  const { escolaAtivaId } = useUserRole();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all');
  const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());

  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
  const [loading, setLoading] = useState(false);
  const [dataCarregada, setDataCarregada] = useState(false);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (open && escolaAtivaId) {
      fetchEscolaInfo();
    } else if (!open) {
      setSelectedTurmaId('all');
      setEstudantes([]);
      setTurmas([]);
      setDataCarregada(false);
    }
  }, [open, escolaAtivaId]);

  useEffect(() => {
    if (open && escolaAtivaId && selectedAno) {
      fetchTurmas(selectedAno);
    }
  }, [selectedAno, open, escolaAtivaId]);

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
    setLoading(true);
    setDataCarregada(false);
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

      // Fetch all students in this school for this year
      const estudantesQuery = query(
        collection(db, 'estudantes'),
        where('escola_id', '==', escolaAtivaId),
        where('ano', '==', parseInt(ano))
      );
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const estudantesData = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante));
      setEstudantes(estudantesData);

      setDataCarregada(true);

      // se a turma selecionada não estiver na lista (ex: mudou de ano), reset para 'all'
      if (selectedTurmaId !== 'all' && !turmasData.some(t => t.id === selectedTurmaId)) {
        setSelectedTurmaId('all');
      }

    } catch (error) {
      console.error("Error fetching turmas: ", error);
      toast.error('Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (turmas.length === 0) {
      toast.error('Nenhum dado para imprimir');
      return;
    }
    printContainer();
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // Filter the turmas to display based on the selected turma
  const displayTurmas = selectedTurmaId === 'all'
    ? turmas
    : turmas.filter(t => t.id === selectedTurmaId);

  const totalCapacidade = displayTurmas.reduce((acc, t) => acc + (t.capacidade || 30), 0);
  const totalMatriculados = displayTurmas.reduce((acc, t) => acc + estudantes.filter(e => e.turma_id === t.id).length, 0);
  const totalVagas = totalCapacidade - totalMatriculados;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl print:overflow-visible print:max-h-none print:w-auto print:max-w-none [&>button]:hidden">
        {/* Controls - Visible only in app, hidden during print */}
        <div className="p-6 border-b bg-gray-50 no-print flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Label htmlFor="select-turma" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Selecionar Turma
            </Label>
            <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId} disabled={!dataCarregada}>
              <SelectTrigger id="select-turma">
                <SelectValue placeholder="Selecione a turma..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Turmas do Ano</SelectItem>
                {turmas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} - {t.serie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <Label htmlFor="select-ano" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Ano Letivo
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

        <div className="print-container p-8 bg-white text-black">
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
                <span className="font-bold mr-2">ANO LETIVO:</span>
                <span>{selectedAno}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">TURMA(S):</span>
                <span>{selectedTurmaId === 'all' ? 'TODAS AS TURMAS' : turmas.find(t => t.id === selectedTurmaId)?.nome || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                <span>{dataAtual}</span>
              </div>
            </div>
            <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg uppercase">
              Relatório de Matrículas
            </div>
          </div>

          {/* Resumo Geral */}
          {dataCarregada && displayTurmas.length > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-4 text-center">
              <div className="border border-black p-3 bg-gray-50">
                <div className="text-xs font-bold text-gray-500 uppercase">Capacidade Total</div>
                <div className="text-2xl font-bold">{totalCapacidade}</div>
              </div>
              <div className="border border-black p-3 bg-gray-50">
                <div className="text-xs font-bold text-gray-500 uppercase">Total Matriculados</div>
                <div className="text-2xl font-bold text-blue-600 print:text-black">{totalMatriculados}</div>
              </div>
              <div className="border border-black p-3 bg-gray-50">
                <div className="text-xs font-bold text-gray-500 uppercase">Vagas Disponíveis</div>
                <div className={`text-2xl font-bold ${totalVagas > 0 ? 'text-green-600' : 'text-red-600'} print:text-black`}>
                  {totalVagas}
                </div>
              </div>
            </div>
          )}

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
                  <th className="border-r border-black p-2 text-left">NOME DA TURMA</th>
                  <th className="border-r border-black p-2 w-32 text-center">TURNO</th>
                  <th className="border-r border-black p-2 w-32 text-center">CAPACIDADE</th>
                  <th className="border-r border-black p-2 w-32 text-center">MATRICULADOS</th>
                  <th className="p-2 w-32 text-center">VAGAS DISPONÍVEIS</th>
                </tr>
              </thead>
              <tbody className="border border-black">
                {displayTurmas.map((turma) => {
                  const capacidade = turma.capacidade || 30; // default 30 se não definido
                  const matriculados = estudantes.filter(e => e.turma_id === turma.id).length;
                  const vagas = capacidade - matriculados;

                  return (
                    <tr key={turma.id} className="hover:bg-gray-50/50 border-b border-black">
                      <td className="border-r border-black py-1.5 px-3 uppercase">{turma.nome} - {turma.serie}</td>
                      <td className="border-r border-black py-1.5 px-3 uppercase text-center">{turma.turno}</td>
                      <td className="border-r border-black py-1.5 px-3 text-center font-medium">{capacidade}</td>
                      <td className="border-r border-black py-1.5 px-3 text-center font-medium text-blue-700 print:text-black">{matriculados}</td>
                      <td className={`py-1.5 px-3 text-center font-bold ${vagas > 0 ? 'text-green-600' : 'text-red-600'} print:text-black`}>
                        {vagas}
                      </td>
                    </tr>
                  );
                })}
                {displayTurmas.length === 0 && dataCarregada && !loading && (
                  <tr>
                    <td colSpan={5} className="border border-black p-8 text-center text-muted-foreground italic">
                      Nenhuma turma encontrada para o ano selecionado.
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
          <Button onClick={handlePrint} disabled={!dataCarregada || displayTurmas.length === 0 || loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4" /> Imprimir Relatório
          </Button>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
      @media print {
        @page {
          size: A4 portrait;
          margin: 1cm;
        }
        body {
          visibility: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-container {
          visibility: visible !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          display: block !important;
        }
        .print-container * {
          visibility: visible !important;
        }
        .no-print, .no-print * {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
        }
        .no-print-bg {
          background-color: transparent !important;
        }
        /* Explicitly hide radix dark overlay and close button */
        .bg-black\\/80, 
        [data-state="open"] > div:first-child:not([role="dialog"]),
        [role="dialog"] > button:last-child {
          display: none !important;
        }
        /* Ensure the dialog portal doesn't hide everything */
        [data-radix-portal], [role="dialog"] {
          visibility: visible !important;
          overflow: visible !important;
          max-height: none !important;
          max-width: none !important;
          height: auto !important;
          width: 100% !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          transform: none !important;
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
        }
        /* Table fixes for print */
        table {
          border-collapse: collapse !important;
          width: 100% !important;
          table-layout: auto !important;
        }
        th, td {
          border: 1px solid black !important;
          color: black !important;
          word-break: break-word !important;
        }
      }
    `}} />
      </DialogContent>
    </Dialog >
  );
}
