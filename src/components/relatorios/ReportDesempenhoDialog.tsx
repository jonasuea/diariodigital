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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano: number;
}

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
  status?: string;
}

interface ReportDesempenhoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDesempenhoDialog({ open, onOpenChange }: ReportDesempenhoDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { escolaAtivaId } = useUserRole();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
  const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());
  const [selectedBimestre, setSelectedBimestre] = useState<string>('all');

  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
  const [loading, setLoading] = useState(false);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (open && escolaAtivaId) {
      fetchEscolaInfo();
    } else if (!open) {
      setSelectedTurmaId('');
      setCurrentTurma(null);
      setEstudantes([]);
      setNotas([]);
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
        fetchData(t.id, selectedAno);
      }
    } else {
      setCurrentTurma(null);
      setEstudantes([]);
      setNotas([]);
    }
  }, [selectedTurmaId, selectedAno, turmas]);

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

      if (selectedTurmaId && !turmasData.some(t => t.id === selectedTurmaId)) {
        setSelectedTurmaId('');
        setCurrentTurma(null);
      }
    } catch (error) {
      console.error("Error fetching turmas: ", error);
    }
  };

  const fetchData = async (turmaId: string, ano: string) => {
    setLoading(true);
    try {
      const estudantesQuery = query(
        collection(db, 'estudantes'),
        where('turma_id', '==', turmaId),
        orderBy('nome')
      );
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const estudantesData = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante));
      setEstudantes(estudantesData);

      const notasQuery = query(
        collection(db, 'notas'),
        where('turma_id', '==', turmaId),
        where('ano', '==', parseInt(ano))
      );
      const notasSnapshot = await getDocs(notasQuery);
      const notasData = notasSnapshot.docs.map(doc => doc.data());
      setNotas(notasData);

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

  // Calcular os dados do gráfico
  const bimestersToDraw = selectedBimestre === 'all' ? [1, 2, 3, 4] : [parseInt(selectedBimestre)];

  const chartData = bimestersToDraw.map(bim => {
    let aprovados = 0;
    let reprovados = 0;
    let transferidos = 0;
    let comNotasDoBimestre = 0;

    estudantes.forEach(est => {
      if (est.status === 'Transferido' || est.status === 'Desistente') {
        transferidos++;
        return;
      }

      const estudanteNotas = notas.filter(n => n.estudante_id === est.id);
      const notasBim = estudanteNotas.filter(n => n[`bimestre_${bim}`] !== undefined && n[`bimestre_${bim}`] !== null);

      if (notasBim.length > 0) {
        comNotasDoBimestre++;
        const media = notasBim.reduce((acc, n) => acc + Number(n[`bimestre_${bim}`]), 0) / notasBim.length;
        if (media >= 6) {
          aprovados++;
        } else {
          reprovados++;
        }
      }
    });

    return {
      name: `${bim}º Bimestre`,
      Aprovados: aprovados,
      Reprovados: reprovados,
      Transferidos: transferidos,
      hasData: comNotasDoBimestre > 0 || transferidos > 0
    };
  }).filter(d => selectedBimestre !== 'all' || d.hasData || d.name === '1º Bimestre'); // Show all selected, or at least 1st if "all" and empty

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

          <div className="w-40">
            <Label htmlFor="select-bimestre" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
              Período
            </Label>
            <Select value={selectedBimestre} onValueChange={setSelectedBimestre}>
              <SelectTrigger id="select-bimestre">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Geral (Anual)</SelectItem>
                <SelectItem value="1">1º Bimestre</SelectItem>
                <SelectItem value="2">2º Bimestre</SelectItem>
                <SelectItem value="3">3º Bimestre</SelectItem>
                <SelectItem value="4">4º Bimestre</SelectItem>
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
                <span className="font-bold mr-2">TURNO:</span>
                <span>{currentTurma?.turno || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                <span>{dataAtual}</span>
              </div>
            </div>
            <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg uppercase">
              Relatório de Desempenho {selectedBimestre === 'all' ? 'Geral' : `- ${selectedBimestre}º Bimestre`}
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="text-center py-10 flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Carregando dados...</p>
            </div>
          ) : (
            <>
              {(!currentTurma || !selectedAno) ? (
                <div className="border border-black p-8 text-center text-muted-foreground italic">
                  Selecione uma turma e ano acima para gerar o relatório.
                </div>
              ) : estudantes.length === 0 ? (
                <div className="border border-black p-4 text-center text-muted-foreground">
                  Nenhum estudante encontrado nesta turma.
                </div>
              ) : (
                <div className="border border-black p-6">
                  <h3 className="text-center font-bold text-lg mb-6 uppercase">
                    Desempenho {selectedBimestre === 'all' ? 'Geral por Bimestre' : `${selectedBimestre}º Bimestre`} - Quantitativo
                  </h3>

                  {/* Tabela Resumo para facilitar visualização na Impressão */}
                  <table className="w-full border-collapse border border-black text-sm mb-8">
                    <thead>
                      <tr className="bg-gray-50 border border-black">
                        <th className="border-r border-black p-2 text-center">Bimestre</th>
                        <th className="border-r border-black p-2 text-center text-green-700">Aprovados (&ge; 6.0)</th>
                        <th className="border-r border-black p-2 text-center text-red-700">Reprovados (&lt; 6.0)</th>
                        <th className="border-black p-2 text-center text-orange-700">Transferidos/Desistentes</th>
                      </tr>
                    </thead>
                    <tbody className="border border-black">
                      {chartData.map((data) => (
                        <tr key={data.name} className="border-b border-black">
                          <td className="border-r border-black p-2 text-center font-bold">{data.name}</td>
                          <td className="border-r border-black p-2 text-center">{data.Aprovados}</td>
                          <td className="border-r border-black p-2 text-center">{data.Reprovados}</td>
                          <td className="p-2 text-center">{data.Transferidos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="h-80 w-full mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        {/* isAnimationActive={false} is critical for printing SVGs perfectly */}
                        <Bar dataKey="Aprovados" fill="#16a34a" isAnimationActive={false} />
                        <Bar dataKey="Reprovados" fill="#dc2626" isAnimationActive={false} />
                        <Bar dataKey="Transferidos" fill="#ea580c" isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
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
          <Button onClick={handlePrint} disabled={!currentTurma || !selectedAno || loading || estudantes.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4" /> Imprimir Relatório
          </Button>
        </div>

      </DialogContent>
    </Dialog >
  );
}
