import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Printer, X, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { printContainer } from '@/lib/print-utils';

interface ReportLotacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Professor {
  id: string;
  nome: string;
}

interface ComponenteCurricular {
  nome: string;
  professorId: string;
}

interface Turma {
  id: string;
  nome: string;
  turno: string;
  ano: number;
  componentes: ComponenteCurricular[];
}

type Lotacao = {
  professorNome: string;
  componente: string;
  turmaNome: string;
  turno: string;
};

export function ReportLotacaoDialog({ open, onOpenChange }: ReportLotacaoDialogProps) {
  const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const { escolaAtivaId } = useUserRole();
  const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
  const [lotacaoData, setLotacaoData] = useState<Lotacao[]>([]);
  const [professoresCount, setProfessoresCount] = useState(0);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (open) {
      if (escolaAtivaId) {
        fetchEscolaInfo();
        fetchLotacaoData(selectedAno);
      }
    }
  }, [open, escolaAtivaId]);

  useEffect(() => {
    if (open && escolaAtivaId && selectedAno) {
      fetchLotacaoData(selectedAno);
    }
  }, [selectedAno]);

  const fetchEscolaInfo = async () => {
    if (!escolaAtivaId) return;
    try {
      const escolaSnap = await getDoc(doc(db, 'escolas', escolaAtivaId));
      if (escolaSnap.exists()) {
        const d = escolaSnap.data();
        setEscolaInfo({
          nome: d.nome || '',
          inep: d.inep || '',
          decreto: d.decreto_criacao || '',
        });
      }
    } catch (error) {
      console.error('Error fetching escola info:', error);
    }
  };

  const fetchLotacaoData = async (ano: string) => {
    if (!ano || !escolaAtivaId) return;
    setLoading(true);
    try {
      // Buscar professores
      const profsQuery = query(
        collection(db, 'professores'),
        where('escola_id', '==', escolaAtivaId),
        where('ativo', '==', true),
        orderBy('nome')
      );
      const profsSnapshot = await getDocs(profsQuery);
      const professores = profsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Professor));
      setProfessoresCount(professores.length);

      // Buscar turmas
      const turmasQuery = query(
        collection(db, 'turmas'),
        where('escola_id', '==', escolaAtivaId),
        where('ano', '==', parseInt(ano))
      );
      const turmasSnapshot = await getDocs(turmasQuery);
      const turmas = turmasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Turma));

      // Mapear alocações (Lotação)
      const lotacaoList: Lotacao[] = [];

      professores.forEach((prof) => {
        let hasTurmas = false;

        // Ordenar turmas por nome para aquele professor
        const turmasDoProf = turmas
          .filter((t) => t.componentes && t.componentes.some((c) => c.professorId === prof.id))
          .sort((a, b) => a.nome.localeCompare(b.nome));

        turmasDoProf.forEach((turma) => {
          turma.componentes.forEach((comp) => {
            if (comp.professorId === prof.id) {
              lotacaoList.push({
                professorNome: prof.nome,
                componente: comp.nome,
                turmaNome: turma.nome,
                turno: turma.turno,
              });
              hasTurmas = true;
            }
          });
        });

        // Caso o professor não tenha nenhuma turma alocada
        if (!hasTurmas) {
          lotacaoList.push({
            professorNome: prof.nome,
            componente: 'Nenhum componente alocado',
            turmaNome: '---',
            turno: '---',
          });
        }
      });

      setLotacaoData(lotacaoList);
    } catch (error) {
      toast.error('Erro ao carregar dados de lotação');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (lotacaoData.length === 0) {
      toast.error('Nenhum dado para imprimir');
      return;
    }
    printContainer();
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // Process data for rowspan (merging cells vertically)
  const processLotacaoForRender = () => {
    const renderedRows = [];
    let i = 0;
    while (i < lotacaoData.length) {
      const currentProf = lotacaoData[i].professorNome;
      let rowspan = 1;

      // Calculate how many rows this professor occupies
      while (i + rowspan < lotacaoData.length && lotacaoData[i + rowspan].professorNome === currentProf) {
        rowspan++;
      }

      // Add the first row for this professor with the rowspan
      renderedRows.push(
        <tr key={`${i}-${lotacaoData[i].componente}`} className="hover:bg-gray-50/50 border-b border-black">
          <td className="border-r border-black py-1 px-2 uppercase font-medium align-middle" rowSpan={rowspan}>
            {currentProf}
          </td>
          <td className="border-r border-black py-1 px-2 uppercase text-xs">{lotacaoData[i].componente}</td>
          <td className="border-r border-black py-1 px-2 uppercase text-center text-xs">{lotacaoData[i].turmaNome}</td>
          <td className="py-1 px-2 uppercase text-center text-xs">{lotacaoData[i].turno}</td>
        </tr>
      );

      // Add the remaining rows for this professor without the professor column
      for (let j = 1; j < rowspan; j++) {
        renderedRows.push(
          <tr key={`${i + j}-${lotacaoData[i + j].componente}`} className="hover:bg-gray-50/50 border-b border-black">
            <td className="border-r border-black py-1 px-2 uppercase text-xs">{lotacaoData[i + j].componente}</td>
            <td className="border-r border-black py-1 px-2 uppercase text-center text-xs">{lotacaoData[i + j].turmaNome}</td>
            <td className="py-1 px-2 uppercase text-center text-xs">{lotacaoData[i + j].turno}</td>
          </tr>
        );
      }

      i += rowspan;
    }
    return renderedRows;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl print:overflow-visible print:max-h-none print:w-auto print:max-w-none [&>button]:hidden">
        {/* Class Selection - Visible only in app, hidden during print */}
        <div className="p-6 border-b bg-gray-50 no-print flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="select-ano" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Selecionar Ano Letivo
            </Label>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger id="select-ano">
                <SelectValue placeholder="Selecione o ano..." />
              </SelectTrigger>
              <SelectContent>
                {anos.map((ano) => (
                  <SelectItem key={ano} value={ano.toString()}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
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
                <span className="font-bold mr-2">PROFESSORES ATIVOS:</span>
                <span>{professoresCount}</span>
              </div>
              <div className="flex border-b border-black pb-1 col-span-2">
                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                <span>{dataAtual}</span>
              </div>
            </div>
            <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg uppercase">
              RELAÇÃO DE LOTAÇÃO DOS PROFESSORES
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
                  <th className="border-r border-black p-2 w-[35%] text-left whitespace-nowrap">NOME DO(A) PROFESSOR(A):</th>
                  <th className="border-r border-black p-2 w-[35%] text-left">COMP. CURRICULAR</th>
                  <th className="border-r border-black p-2 w-[15%] text-center">TURMA</th>
                  <th className="p-2 w-[15%] text-center">TURNO</th>
                </tr>
              </thead>
              <tbody className="border border-black">
                {lotacaoData.length > 0 ? (
                  processLotacaoForRender()
                ) : (
                  <tr>
                    <td colSpan={4} className="border border-black p-8 text-center text-muted-foreground italic">
                      Nenhum dado encontrado para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="mt-8 text-right text-xs text-gray-500 last-page-only">
            {/* The page count functionality using CSS content is tricky to get right across all browsers without complex scripting. A generic footer is used here. */}
            Documento gerado pelo sistema Educafácil
          </div>
        </div>

        {/* Action Buttons (Sticky at bottom) */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3 no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
          <Button onClick={handlePrint} disabled={loading || lotacaoData.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
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
    </Dialog>
  );
}
