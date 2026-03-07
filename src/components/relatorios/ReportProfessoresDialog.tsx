import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Printer, X, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { printElement } from '@/lib/print-utils';

interface ReportProfessoresDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Professor {
    id: string;
    nome: string;
    matricula?: string;
}

interface ComponenteCurricular {
    nome: string;
    professorId: string;
}

interface Turma {
    id: string;
    nome: string;
    turno: string;
    componentes: ComponenteCurricular[];
}

interface ProfessorRow {
    professorId: string;
    professorNome: string;
    matricula: string;
    componente: string;
    turmaNome: string;
    turno: string;
}

export function ReportProfessoresDialog({ open, onOpenChange }: ReportProfessoresDialogProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());
    const [includeTurma, setIncludeTurma] = useState(false);
    const [includeComponente, setIncludeComponente] = useState(false);
    const [loading, setLoading] = useState(false);
    const { escolaAtivaId } = useUserRole();
    const [escolaInfo, setEscolaInfo] = useState({ nome: '', inep: '', decreto: '' });
    const [reportData, setReportData] = useState<ProfessorRow[]>([]);

    const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        if (open && escolaAtivaId) {
            fetchEscolaInfo();
            fetchData();
        }
    }, [open, escolaAtivaId, selectedAno, includeTurma, includeComponente]);

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

    const fetchData = async () => {
        if (!escolaAtivaId) return;
        setLoading(true);
        try {
            // Buscar todos os professores ativos da escola
            const profsQuery = query(
                collection(db, 'professores'),
                where('escola_id', '==', escolaAtivaId),
                where('ativo', '==', true),
                orderBy('nome')
            );
            const profsSnapshot = await getDocs(profsQuery);
            const professores = profsSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    nome: data.nome,
                    matricula: data.matricula || '---'
                } as Professor;
            });

            let rows: ProfessorRow[] = [];

            if (!includeTurma && !includeComponente) {
                // Lista simples de professores
                rows = professores.map(p => ({
                    professorId: p.id,
                    professorNome: p.nome,
                    matricula: p.matricula || '---',
                    componente: '',
                    turmaNome: '',
                    turno: ''
                }));
            } else {
                // Buscar turmas para cruzar dados
                const turmasQuery = query(
                    collection(db, 'turmas'),
                    where('escola_id', '==', escolaAtivaId),
                    where('ano', '==', parseInt(selectedAno))
                );
                const turmasSnapshot = await getDocs(turmasQuery);
                const turmas = turmasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Turma));

                professores.forEach((prof) => {
                    const profTurmasComps: { turmaNome: string, turno: string, componente: string }[] = [];

                    turmas.forEach(turma => {
                        if (turma.componentes) {
                            turma.componentes.forEach(comp => {
                                if (comp.professorId === prof.id) {
                                    profTurmasComps.push({
                                        turmaNome: turma.nome,
                                        turno: turma.turno,
                                        componente: comp.nome
                                    });
                                }
                            });
                        }
                    });

                    if (profTurmasComps.length === 0) {
                        rows.push({
                            professorId: prof.id,
                            professorNome: prof.nome,
                            matricula: prof.matricula || '---',
                            componente: includeComponente ? 'Nenhum' : '',
                            turmaNome: includeTurma ? '---' : '',
                            turno: includeTurma ? '---' : ''
                        });
                    } else {
                        // Se as opções estiverem marcadas, expandimos as linhas para cada vínculo
                        // Caso contrário, poderíamos agrupar, mas a lista de professores com estas opções
                        // geralmente implica em ver a alocação.

                        // Agrupar por turma se apenas turma for selecionada?
                        // Para manter simples e útil, se incluir qualquer um, mostramos as combinações.

                        const processedLinks = new Set();

                        profTurmasComps.forEach(link => {
                            const key = includeTurma && includeComponente
                                ? `${link.turmaNome}-${link.componente}`
                                : includeTurma ? link.turmaNome : link.componente;

                            if (!processedLinks.has(key)) {
                                rows.push({
                                    professorId: prof.id,
                                    professorNome: prof.nome,
                                    matricula: prof.matricula || '---',
                                    componente: includeComponente ? link.componente : '',
                                    turmaNome: includeTurma ? link.turmaNome : '',
                                    turno: includeTurma ? link.turno : ''
                                });
                                processedLinks.add(key);
                            }
                        });
                    }
                });
            }

            setReportData(rows);
        } catch (error) {
            console.error('Error fetching report data:', error);
            toast.error('Erro ao carregar dados dos professores');
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

    const processRowsForRender = () => {
        const renderedRows = [];
        let i = 0;
        while (i < reportData.length) {
            const currentProfId = reportData[i].professorId;
            let rowspan = 1;

            while (i + rowspan < reportData.length && reportData[i + rowspan].professorId === currentProfId) {
                rowspan++;
            }

            renderedRows.push(
                <tr key={`${i}-${reportData[i].professorId}`} className="border-b border-black">
                    <td className="border-r border-black py-1 px-2 uppercase text-center align-middle" rowSpan={rowspan}>
                        {reportData[i].matricula}
                    </td>
                    <td className="border-r border-black py-1 px-2 uppercase font-medium align-middle" rowSpan={rowspan}>
                        {reportData[i].professorNome}
                    </td>
                    {includeComponente && (
                        <td className={`border-r border-black py-1 px-2 uppercase text-xs ${!includeTurma ? '' : ''}`}>
                            {reportData[i].componente}
                        </td>
                    )}
                    {includeTurma && (
                        <>
                            <td className="border-r border-black py-1 px-2 uppercase text-center text-xs">
                                {reportData[i].turmaNome}
                            </td>
                            <td className="py-1 px-2 uppercase text-center text-xs">
                                {reportData[i].turno}
                            </td>
                        </>
                    )}
                </tr>
            );

            for (let j = 1; j < rowspan; j++) {
                renderedRows.push(
                    <tr key={`${i + j}-${reportData[i + j].professorId}`} className="border-b border-black">
                        {includeComponente && (
                            <td className="border-r border-black py-1 px-2 uppercase text-xs">
                                {reportData[i + j].componente}
                            </td>
                        )}
                        {includeTurma && (
                            <>
                                <td className="border-r border-black py-1 px-2 uppercase text-center text-xs">
                                    {reportData[i + j].turmaNome}
                                </td>
                                <td className="py-1 px-2 uppercase text-center text-xs">
                                    {reportData[i + j].turno}
                                </td>
                            </>
                        )}
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
                <div className="p-6 border-b bg-gray-50 no-print space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="w-32">
                            <Label htmlFor="select-ano" className="text-xs font-bold uppercase text-gray-500 mb-1 block">
                                Ano Letivo
                            </Label>
                            <Select value={selectedAno} onValueChange={setSelectedAno}>
                                <SelectTrigger id="select-ano">
                                    <SelectValue placeholder="Ano" />
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

                        <div className="flex items-center space-x-4 mb-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="include-turma"
                                    checked={includeTurma}
                                    onCheckedChange={(checked) => setIncludeTurma(!!checked)}
                                />
                                <Label htmlFor="include-turma" className="text-sm cursor-pointer">Incluir Turma</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="include-componente"
                                    checked={includeComponente}
                                    onCheckedChange={(checked) => setIncludeComponente(!!checked)}
                                />
                                <Label htmlFor="include-componente" className="text-sm cursor-pointer">Incluir Componente</Label>
                            </div>
                        </div>

                        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary mb-2 ml-auto" />}
                    </div>
                </div>

                <div ref={printRef} className="print-container p-8 bg-white text-black min-h-[500px]">
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
                                <span className="font-bold mr-2">ANO LETIVO:</span>
                                <span>{selectedAno}</span>
                            </div>
                            <div className="flex border-b border-black pb-1 col-span-2">
                                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                                <span>{dataAtual}</span>
                            </div>
                        </div>
                        <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold no-print-bg uppercase">
                            RELAÇÃO DE PROFESSORES
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-50 border border-black">
                                <th className="border-r border-black p-2 w-32 text-center">MATRÍCULA</th>
                                <th className="border-r border-black p-2 text-left">NOME DO PROFESSOR</th>
                                {includeComponente && <th className="border-r border-black p-2 text-left">COMP. CURRICULAR</th>}
                                {includeTurma && (
                                    <>
                                        <th className="border-r border-black p-2 w-24 text-center">TURMA</th>
                                        <th className="p-2 w-24 text-center">TURNO</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="border border-black">
                            {reportData.length > 0 ? (
                                processRowsForRender()
                            ) : (
                                <tr>
                                    <td colSpan={2 + (includeComponente ? 1 : 0) + (includeTurma ? 2 : 0)} className="p-8 text-center text-muted-foreground italic">
                                        {loading ? 'Carregando...' : 'Nenhum professor encontrado.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="mt-8 text-right text-xs text-gray-500 last-page-only">
                        Documento gerado pelo sistema EducaFácil
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3 no-print">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
                        <X className="h-4 w-4" /> Fechar
                    </Button>
                    <Button onClick={handlePrint} disabled={loading || reportData.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4" /> Imprimir Relatório
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
