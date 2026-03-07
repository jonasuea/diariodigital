import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { printElement } from '@/lib/print-utils';

interface Nota {
    id: string;
    componente: string;
    professor_nome?: string;
    bimestre_1: number | null;
    bimestre_2: number | null;
    bimestre_3: number | null;
    bimestre_4: number | null;
    media_anual: number | null;
}

interface BoletimDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estudanteNome: string;
    estudanteMatricula: string;
    estudanteNascimento?: string;
    turmaNome: string;
    turmaSerie: string;
    ano: string;
    notas: Nota[];
    faltasAnuais: Record<string, number[]>; // componente -> [jan..dez]
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function calcularMedia(nota: Nota): number | null {
    if (nota.media_anual != null) return nota.media_anual;
    const { bimestre_1, bimestre_2, bimestre_3, bimestre_4 } = nota;
    if (bimestre_1 != null && bimestre_2 != null && bimestre_3 != null && bimestre_4 != null) {
        return Math.round(((bimestre_1 + bimestre_2 + bimestre_3 + bimestre_4) / 4) * 10) / 10;
    }
    return null;
}

function getSituacao(media: number | null): string {
    if (media === null) return 'Em andamento';
    return media >= 6 ? 'Aprovado' : 'Reprovado';
}

function fmtNota(n?: number | null): string {
    return n != null ? n.toFixed(1) : '-';
}

export function BoletimDialog({
    open, onOpenChange,
    estudanteNome, estudanteMatricula, estudanteNascimento,
    turmaNome, turmaSerie, ano, notas, faltasAnuais
}: BoletimDialogProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataNasc = estudanteNascimento
        ? format(parseISO(estudanteNascimento), 'dd/MM/yyyy', { locale: ptBR })
        : '—';

    // Todos os componentes que aparecem em notas ou em faltas
    const todosComponentes = Array.from(
        new Set([...notas.map(n => n.componente), ...Object.keys(faltasAnuais)])
    ).sort();

    const totalFaltasGeral = Object.values(faltasAnuais)
        .reduce((acc, arr) => acc + arr.reduce((a, b) => a + b, 0), 0);

    const handlePrint = () => {
        if (printRef.current) {
            printElement(printRef.current);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="no-print">
                    <DialogTitle>Boletim Escolar</DialogTitle>
                </DialogHeader>

                <div ref={printRef} className="print-container p-4 bg-white text-black">

                    {/* Cabeçalho */}
                    <div className="header text-center border-b-2 border-blue-900 pb-3">
                        <h1 className="text-lg font-bold text-blue-900 uppercase tracking-widest">Secretaria de Educação</h1>
                        <h2 className="text-xs text-gray-500 mt-1">Sistema EducaFácil</h2>
                    </div>

                    <div className="title text-center font-bold uppercase bg-blue-900 text-white py-1.5 px-4 tracking-widest text-base">
                        Boletim Escolar — {ano}
                    </div>

                    {/* Dados do Estudante */}
                    <div className="student-grid grid grid-cols-3 gap-3 border border-gray-200 rounded p-3 bg-gray-50">
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Nome do Estudante</label>
                            <span className="font-semibold text-sm">{estudanteNome}</span>
                        </div>
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Matrícula</label>
                            <span className="font-semibold text-sm">{estudanteMatricula}</span>
                        </div>
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Data de Nascimento</label>
                            <span className="font-semibold text-sm">{dataNasc}</span>
                        </div>
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Turma</label>
                            <span className="font-semibold text-sm">{turmaNome || '—'}</span>
                        </div>
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Classificação</label>
                            <span className="font-semibold text-sm">{turmaSerie || '—'}</span>
                        </div>
                        <div className="field">
                            <label className="text-xs text-gray-500 uppercase block">Ano Letivo</label>
                            <span className="font-semibold text-sm">{ano}</span>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <div className="section-title font-bold text-xs uppercase bg-blue-50 border-l-4 border-blue-900 px-3 py-1.5 mb-2">
                            I — Rendimento Escolar
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-left w-44">Componente Curricular</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-left w-36">Professor(a)</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-14">1º Bim</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-14">2º Bim</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-14">3º Bim</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-14">4º Bim</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-16">Média</th>
                                    <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-24">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notas.length > 0 ? notas.map((nota) => {
                                    const media = calcularMedia(nota);
                                    const sit = getSituacao(media);
                                    return (
                                        <tr key={nota.id}>
                                            <td className="border border-gray-300 p-1.5 text-left font-medium">{nota.componente}</td>
                                            <td className="border border-gray-300 p-1.5 text-left text-gray-600">{nota.professor_nome || '—'}</td>
                                            <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_1)}</td>
                                            <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_2)}</td>
                                            <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_3)}</td>
                                            <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_4)}</td>
                                            <td className={`border border-gray-300 p-1.5 text-center font-bold ${media == null ? '' : media >= 6 ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                {fmtNota(media)}
                                            </td>
                                            <td className={`border border-gray-300 p-1.5 text-center font-semibold ${sit === 'Aprovado' ? 'text-green-700' :
                                                sit === 'Reprovado' ? 'text-red-700' :
                                                    'text-amber-700'
                                                }`}>
                                                {sit}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={8} className="border border-gray-300 p-3 text-center text-gray-400 italic">
                                            Nenhuma nota registrada para este ano.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Frequência / Faltas */}
                    <div>
                        <div className="section-title font-bold text-xs uppercase bg-blue-50 border-l-4 border-blue-900 px-3 py-1.5 mb-2">
                            II — Frequência (Faltas por Componente)
                        </div>
                        {todosComponentes.length > 0 ? (
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-left min-w-[160px]">Componente</th>
                                        {MESES.map(m => (
                                            <th key={m} className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-10">{m}</th>
                                        ))}
                                        <th className="border border-blue-900 bg-blue-900 text-white p-1.5 text-center w-12">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todosComponentes.map(comp => {
                                        const faltas = faltasAnuais[comp] || Array(12).fill(0);
                                        const total = faltas.reduce((a, b) => a + b, 0);
                                        return (
                                            <tr key={comp}>
                                                <td className="border border-gray-300 p-1.5 text-left font-medium">{comp}</td>
                                                {faltas.map((f, i) => (
                                                    <td key={i} className={`border border-gray-300 p-1.5 text-center ${f > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>
                                                        {f > 0 ? f : '-'}
                                                    </td>
                                                ))}
                                                <td className={`border border-gray-300 p-1.5 text-center font-bold ${total > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                                                    {total > 0 ? total : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Total geral */}
                                    <tr className="bg-gray-50">
                                        <td className="border border-gray-300 p-1.5 font-bold">Total Geral de Faltas</td>
                                        <td colSpan={12} className="border border-gray-300 p-1.5"></td>
                                        <td className={`border border-gray-300 p-1.5 text-center font-bold ${totalFaltasGeral > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                            {totalFaltasGeral}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-xs text-gray-400 italic px-2">Nenhuma falta registrada para este ano.</p>
                        )}
                    </div>

                    {/* Assinaturas */}
                    <div className="rodape flex justify-between mt-10">
                        <div className="ass text-center">
                            <hr className="border-t border-gray-800 mb-1 w-48" />
                            <p className="text-xs">Diretor(a)</p>
                        </div>
                        <div className="ass text-center">
                            <hr className="border-t border-gray-800 mb-1 w-48" />
                            <p className="text-xs">Secretário(a) Escolar</p>
                        </div>
                        <div className="ass text-center">
                            <hr className="border-t border-gray-800 mb-1 w-48" />
                            <p className="text-xs">Responsável pelo Estudante</p>
                        </div>
                    </div>

                    {/* Rodapé */}
                    <div className="emissao text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-4">
                        Boletim emitido em {hoje} via sistema EducaFácil.
                    </div>
                </div>
                <DialogFooter className="no-print">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                    <Button onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir / Salvar PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
