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
    componentes?: any[];
}

interface Estudante {
    id: string;
    nome: string;
    matricula: string;
    status?: string;
}

interface ReportAtaFinalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReportAtaFinalDialog({ open, onOpenChange }: ReportAtaFinalDialogProps) {
    const { escolaAtivaId } = useUserRole();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
    const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
    const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());

    const [estudantes, setEstudantes] = useState<Estudante[]>([]);
    const [notas, setNotas] = useState<any[]>([]);
    const [frequencia, setFrequencia] = useState<any[]>([]);
    const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '', municipio: 'Itacoatiara - AM' });
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
            setFrequencia([]);
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
            setFrequencia([]);
        }
    }, [selectedTurmaId, selectedAno, turmas]);

    const fetchEscolaInfo = async () => {
        if (!escolaAtivaId) return;
        try {
            const escolaSnap = await getDoc(doc(db, 'escolas', escolaAtivaId));
            if (escolaSnap.exists()) {
                const d = escolaSnap.data();
                setEscolaInfo(prev => ({
                    ...prev,
                    nome: d.nome || '',
                    inep: d.inep || '',
                    decreto: d.decreto_criacao || '',
                    municipio: d.municipio ? `${d.municipio} - ${d.estado || 'AM'}` : prev.municipio
                }));
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
        } catch (error) {
            console.error("Error fetching turmas:", error);
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
            setNotas(notasSnapshot.docs.map(doc => doc.data()));

            const freqQuery = query(
                collection(db, 'frequencias'),
                where('turma_id', '==', turmaId),
                where('data', '>=', `${ano}-01-01`),
                where('data', '<=', `${ano}-12-31`)
            );
            const freqSnapshot = await getDocs(freqQuery);
            setFrequencia(freqSnapshot.docs.map(doc => doc.data()));

        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (!currentTurma) {
            toast.error('Selecione uma turma primeiro');
            return;
        }
        printContainer();
    };

    const getSituacao = (estudante: Estudante) => {
        if (estudante.status === 'Transferido') return 'TRANSFERIDO';
        if (estudante.status === 'Desistente') return 'DESISTENTE';

        // Se ainda não tem estudantes carregados ou notas
        if (notas.length === 0) return '-';

        const componentes = currentTurma?.componentes || [];
        if (componentes.length === 0) return '-';

        const estudanteNotas = notas.filter(n => n.estudante_id === estudante.id);

        // Se não tem nenhuma nota lançada ainda
        if (estudanteNotas.length === 0) return 'CURSANDO';

        const temReprovacao = componentes.some(comp => {
            const nota = estudanteNotas.find(n => n.componente === comp.nome);
            // Considera reprovado se faltar média anual ou se for < 6
            return !nota || nota.media_anual === undefined || nota.media_anual === null || nota.media_anual < 6;
        });

        return temReprovacao ? 'REPROVADO' : 'APROVADO';
    };

    const componentes = currentTurma?.componentes || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl [&>button]:hidden">
                {/* Controls */}
                <div className="p-6 border-b bg-gray-50 no-print flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px] max-w-xs">
                        <Label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Turma</Label>
                        <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a turma..." />
                            </SelectTrigger>
                            <SelectContent>
                                {turmas.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.nome} - {t.serie}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-32">
                        <Label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Ano Letivo</Label>
                        <Select value={selectedAno} onValueChange={setSelectedAno}>
                            <SelectTrigger>
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

                <div className="print-container p-8 bg-white text-black min-h-screen">
                    <div className="text-center font-bold text-blue-800 uppercase text-xs mb-1">
                        {escolaInfo.nome || 'NOME DA ESCOLA'}
                    </div>
                    <div className="text-center font-bold text-sm uppercase mb-4 underline">
                        ATA FINAL DO ENSINO FUNDAMENTAL
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] mb-4 border-t border-b border-black py-2">
                        <div className="space-y-1">
                            <p><span className="font-bold">INEP:</span> <span className="text-blue-700">{escolaInfo.inep}</span></p>
                            <p><span className="font-bold">ESTABELECIMENTO DE ENSINO:</span> <span className="text-blue-700">{escolaInfo.nome}</span></p>
                            <p><span className="font-bold">CURSO:</span> <span className="text-blue-700">ENSINO FUND. ANOS FINAIS</span></p>
                            <p><span className="font-bold">CLASSIF.:</span> <span className="text-blue-700">{currentTurma?.serie}</span></p>
                        </div>
                        <div className="space-y-1">
                            <p><span className="font-bold">DECRETO:</span> <span className="text-blue-700">{escolaInfo.decreto}</span></p>
                            <p><span className="font-bold">&nbsp;</span></p>
                            <p><span className="font-bold">&nbsp;</span></p>
                            <p><span className="font-bold">TURMA:</span> <span className="text-blue-700">{currentTurma?.nome}</span></p>
                        </div>
                        <div className="space-y-1">
                            <p><span className="font-bold text-right w-full block">MUNICÍPIO: <span className="text-blue-700">{escolaInfo.municipio}</span></span></p>
                            <p><span className="font-bold text-right w-full block">AMPARO LEGAL: <span className="text-blue-700">Res. nº 120/02 - CEE/AM</span></span></p>
                            <p><span className="font-bold text-right w-full block">TURNO: <span className="text-blue-700">{currentTurma?.turno || 'MATUTINO'}</span></span></p>
                            <p><span className="font-bold text-right w-full block">ANO LETIVO: <span className="text-blue-700">{selectedAno}</span></span></p>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-[9px]">
                        <thead>
                            <tr className="border-b border-black">
                                <th rowSpan={2} className="border-r border-black p-1 w-6">Nº</th>
                                <th rowSpan={2} className="border-r border-black p-1 text-left">NOME DO ESTUDANTE</th>
                                {componentes.map((c, i) => (
                                    <th key={i} colSpan={2} className="border-r border-black p-0.5 text-center text-[7px] italic truncate max-w-[50px]">
                                        {c.nome}
                                    </th>
                                ))}
                                <th rowSpan={2} className="p-1 text-center w-24">OBSERVAÇÃO</th>
                            </tr>
                            <tr className="border-b border-black">
                                {componentes.map((_, i) => (
                                    <header key={i} className="contents">
                                        <th className="border-r border-black p-0.5 text-center w-6">M.F</th>
                                        <th className="border-r border-black p-0.5 text-center w-6 text-red-600">Fal</th>
                                    </header>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {estudantes.map((estudante, idx) => (
                                <tr key={estudante.id} className="border-b border-black h-5">
                                    <td className="border-r border-black text-center">{String(idx + 1).padStart(2, '0')}</td>
                                    <td className="border-r border-black px-1 uppercase font-medium truncate max-w-[180px]">{estudante.nome}</td>
                                    {componentes.map((comp, i) => {
                                        const nota = notas.find(n => n.estudante_id === estudante.id && n.componente === comp.nome);
                                        const faltas = frequencia.filter(f => f.estudante_id === estudante.id && f.status !== 'presente' && f.componente === comp.nome).length;
                                        return (
                                            <header key={i} className="contents">
                                                <td className="border-r border-black text-center">{nota?.media_anual != null ? nota.media_anual.toFixed(1) : '-'}</td>
                                                <td className="border-r border-black text-center text-red-600">{faltas > 0 ? faltas : ''}</td>
                                            </header>
                                        );
                                    })}
                                    <td className="border-black px-1 text-[8px] font-bold text-center uppercase">
                                        {getSituacao(estudante)}
                                    </td>
                                </tr>
                            ))}
                            {/* Empty rows until 28 */}
                            {Array.from({ length: Math.max(0, 28 - estudantes.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="border-b border-black h-5">
                                    <td className="border-r border-black text-center">{String(estudantes.length + i + 1).padStart(2, '0')}</td>
                                    <td className="border-r border-black"></td>
                                    {componentes.map((_, j) => (
                                        <header key={j} className="contents">
                                            <td className="border-r border-black"></td>
                                            <td className="border-r border-black"></td>
                                        </header>
                                    ))}
                                    <td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex justify-between items-end mt-4 text-[9px]">
                        <div className="italic">OBS: M.F = Média Final / Fal = Faltas</div>
                        <div className="flex gap-20">
                            <div className="text-center">
                                <div className="border-t border-black w-48 mt-8">SECRETÁRIO(A)</div>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-black w-48 mt-8">GESTOR(A)</div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-4 right-8 text-[10px] text-gray-400 font-bold">
                        Página 1
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3 no-print">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="h-4 w-4 mr-2" /> Fechar
                    </Button>
                    <Button onClick={handlePrint} disabled={!currentTurma || loading} className="bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4 mr-2" /> Imprimir ATA FINAL
                    </Button>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
          @media print {
            @page {
              size: A4 landscape !important;
              margin: 0.5cm !important;
            }
            body { 
              visibility: hidden !important; 
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-container {
              visibility: visible !important;
              position: absolute !important;
              left: 0 !important; top: 0 !important;
              width: 100% !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              display: block !important;
            }
            .no-print { display: none !important; }
            table { border-collapse: collapse !important; width: 100% !important; }
            th, td { border: 1px solid black !important; }
            .underline { text-decoration: underline !important; }
            .text-blue-800 { color: #1e40af !important; }
            .text-blue-700 { color: #1d4ed8 !important; }
            .text-red-600 { color: #dc2626 !important; }
          }
        `}} />
            </DialogContent>
        </Dialog>
    );
}
