import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    turno: string;
    ano: number;
}

interface Estudante {
    id: string;
    nome: string;
}

interface RelatorioReuniaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    turma?: Turma | null;
}

export function RelatorioReuniaoDialog({ open, onOpenChange, turma: initialTurma }: RelatorioReuniaoDialogProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { escolaAtivaId } = useUserRole();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
    const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
    const [estudantes, setEstudantes] = useState<Estudante[]>([]);
    const [loading, setLoading] = useState(false);
    const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
    const [presencas, setPresencas] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (open) {
            if (escolaAtivaId) {
                fetchTurmas();
                fetchEscolaInfo();
            }
            if (initialTurma) {
                setSelectedTurmaId(initialTurma.id);
                setCurrentTurma(initialTurma);
            } else {
                setSelectedTurmaId('');
                setCurrentTurma(null);
                setEstudantes([]);
            }
        }
    }, [open, initialTurma, escolaAtivaId]);

    useEffect(() => {
        if (selectedTurmaId && turmas.length > 0) {
            const t = turmas.find(t => t.id === selectedTurmaId);
            if (t) {
                setCurrentTurma(t);
                fetchStudents(t.id);
            }
        }
    }, [selectedTurmaId, turmas]);

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

    const fetchTurmas = async () => {
        try {
            const q = query(
                collection(db, 'turmas'),
                where('escola_id', '==', escolaAtivaId),
                orderBy('ano', 'desc'),
                orderBy('nome')
            );
            const querySnapshot = await getDocs(q);
            const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
            setTurmas(turmasData);
        } catch (error) {
            console.error("Error fetching turmas:", error);
        }
    };

    const fetchStudents = async (turmaId: string) => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'estudantes'),
                where('turma_id', '==', turmaId),
                where('status', '==', 'Frequentando'),
                orderBy('nome')
            );
            const querySnapshot = await getDocs(q);
            const estudantesData = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome } as Estudante));
            setEstudantes(estudantesData);
            setPresencas({});
        } catch (error) {
            console.error("Error fetching students:", error);
            toast.error('Sem permissão para carregar estudantes');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            printElement(printRef.current);
        }
    };

    const togglePresenca = (id: string) => {
        setPresencas(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const dataAtual = new Date().toLocaleDateString('pt-BR');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl [&>button]:hidden">
                {/* Class Selection - Visible only in app, hidden during print */}
                <div className="p-6 border-b bg-gray-50 no-print flex items-center gap-4">
                    <div className="flex-1 max-w-xs">
                        <Label htmlFor="select-turma" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
                            Selecionar Turma
                        </Label>
                        <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                            <SelectTrigger id="select-turma">
                                <SelectValue placeholder="Selecione a turma..." />
                            </SelectTrigger>
                            <SelectContent>
                                {turmas.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.nome} - {t.serie} ({t.ano})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>

                <div ref={printRef} className="print-container p-8 bg-white text-black min-h-screen">
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
                                <span className="font-bold mr-2">DATA:</span>
                                <span>{dataAtual}</span>
                            </div>
                        </div>
                        <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg">
                            RELAÇÃO DE ESTUDANTES - CONTROLE DE REUNIÃO
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
                                    <th className="border-r border-black p-2 w-[45%] text-left whitespace-nowrap">NOME DO (A) ESTUDANTE:</th>
                                    <th className="border-r border-black p-2 w-[55%] text-left">ASSINATURA</th>
                                    <th className="p-2 w-24 text-center no-print border-black border-l">PRESENTE</th>
                                </tr>
                            </thead>
                            <tbody className="border border-black">
                                {estudantes.map((estudante, index) => (
                                    <tr key={estudante.id} className="hover:bg-gray-50/50 border-b border-black">
                                        <td className="border-r border-black py-0.5 px-2 text-center whitespace-nowrap">{String(index + 1).padStart(2, '0')}</td>
                                        <td className="border-r border-black py-0.5 px-2 uppercase whitespace-nowrap">{estudante.nome}</td>
                                        <td className="border-r border-black py-0.5 px-2"></td>
                                        <td className="py-0.5 px-2 text-center flex justify-center items-center h-full no-print">
                                            <Checkbox
                                                checked={presencas[estudante.id] || false}
                                                onCheckedChange={() => togglePresenca(estudante.id)}
                                                className="rounded-full h-4 w-4 border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 print:border-black print:data-[state=checked]:bg-black print:data-[state=checked]:border-black mt-1"
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {!currentTurma && !loading && (
                                    <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-muted-foreground italic">
                                            Selecione uma turma acima para gerar o relatório.
                                        </td>
                                    </tr>
                                )}
                                {currentTurma && estudantes.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={4} className="border border-black p-4 text-center text-muted-foreground">
                                            Nenhum estudante encontrado nesta turma com status "Frequentando".
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
                    <Button onClick={handlePrint} disabled={!currentTurma || loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4" /> Imprimir Relatório
                    </Button>
                </div>

            </DialogContent>
        </Dialog >
    );
}
