import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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

interface DocumentPrintDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    type: 'declaracaoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | 'declaracaoComparecimento' | 'termoUsoImagem' | 'termoAutorizacaoTrajeto';
    estudanteNome: string;
    estudanteMatricula: string;
    estudanteNascimento?: string;
    rg?: string;
    cpf?: string;
    responsavelNome?: string;
    responsavelRg?: string;
    endereco?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    turmaNome: string;
    turmaSerie: string;
    turmaTurno: string;
    ano: string;
    notas?: Nota[];
}

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

/**
 * Parses a date string that could be in YYYY-MM-DD or DD/MM/YYYY format.
 * Returns null if the date is invalid.
 */
const safeParseDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;

    // Se já for um objeto Date
    if (dateVal instanceof Date) return isValid(dateVal) ? dateVal : null;

    // Se for um Timestamp do Firestore
    if (typeof dateVal.toDate === 'function') {
        const d = dateVal.toDate();
        return isValid(d) ? d : null;
    }

    if (typeof dateVal !== 'string') return null;

    // Tenta formato ISO (YYYY-MM-DD)
    const isoDate = parseISO(dateVal);
    if (isValid(isoDate) && isoDate.getFullYear() > 1900) {
        return isoDate;
    }

    // Tenta formato brasileiro (DD/MM/AAAA)
    if (dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (isValid(date) && date.getFullYear() > 1900) {
                return date;
            }
        }
    }

    return null;
};

export function DocumentPrintDialog({
    open, onOpenChange, title, type,
    estudanteNome, estudanteMatricula, estudanteNascimento, rg, cpf, responsavelNome, responsavelRg,
    endereco, bairro, cidade, estado,
    turmaNome, turmaSerie, turmaTurno, ano, notas = []
}: DocumentPrintDialogProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const parsedNasc = safeParseDate(estudanteNascimento);
    const dataNasc = parsedNasc
        ? format(parsedNasc, 'dd/MM/yyyy', { locale: ptBR })
        : 'Não informado';

    const enderecoCompleto = [endereco, bairro, cidade, estado]
        .filter(Boolean)
        .join(', ') || 'Não informado';

    const renderTextContent = () => {
        if (type === 'declaracaoMatricula') {
            return (
                <div className="section mt-4">
                    <p className="text-justify leading-7">
                        Declaramos para os devidos fins que o(a) estudante(a) <strong>{estudanteNome}</strong>, portador(a) do RG nº {rg || 'Não informado'} e CPF nº {cpf || 'Não informado'}, está devidamente matriculado(a) nesta instituição de ensino na série <strong>{turmaSerie || '-'}</strong> do Ensino Fundamental, no ano letivo de <strong>{ano}</strong>, turno <strong>{turmaTurno || '-'}</strong>.
                    </p>
                </div>
            );
        }

        if (type === 'termoCompromisso') {
            return (
                <div className="section mt-4">
                    <p className="text-justify leading-7 mb-4">
                        O(A) estudante(a) <strong>{estudanteNome}</strong>, matriculado(a) na série {turmaSerie || '-'} da turma {turmaNome || '-'}, e seu responsável <strong>{responsavelNome || 'Não informado'}</strong>, comprometem-se a:
                    </p>
                    <ol className="list-decimal pl-8 leading-7 space-y-2">
                        <li>Respeitar as normas da instituição;</li>
                        <li>Zelar pelo patrimônio escolar;</li>
                        <li>Manter assiduidade e pontualidade;</li>
                        <li>Cumprir as atividades pedagógicas;</li>
                        <li>Participar das reuniões quando convocado.</li>
                    </ol>
                </div>
            );
        }

        if (type === 'autorizacaoSaida') {
            return (
                <div className="section mt-4">
                    <p className="text-justify leading-7 mb-4">
                        Eu, <strong>{responsavelNome || 'Não informado'}</strong>, responsável pelo(a) estudante(a) <strong>{estudanteNome}</strong>, da turma {turmaNome || '-'}, autorizo sua participação na atividade externa denominada "_______________________________________", que ocorrerá em ____/____/_________, das ____:____ às ____:____, no local _______________________________________.
                    </p>
                    <p className="text-justify leading-7">
                        Declaro estar ciente dos riscos e responsabilidades envolvidas.
                    </p>
                </div>
            );
        }
        if (type === 'declaracaoComparecimento') {
            return (
                <div className="section mt-4">
                    <p className="text-justify leading-7 mb-4">
                        Declaramos para os devidos fins que se fazem necessários que o(a) estudante <strong>{estudanteNome}</strong> matriculado(a) na série <strong>{turmaSerie || '-'}</strong> do Ensino FUND. ANOS FINAIS, turma: <strong>{turmaNome || '-'}</strong> no turno: <strong>{turmaTurno || '-'}</strong>.
                    </p>
                    <p className="text-justify leading-7 mb-4">
                        O(a) senhor(a) <strong>{responsavelNome || 'Não informado'}</strong>, RG: <strong>{responsavelRg || 'Não informado'}</strong>, domiciliado(a) no(a) <strong>{enderecoCompleto}</strong>; compareceu a 1ª reunião de pais do ano letivo de <strong>{ano}</strong>, para tratar de assuntos referentes à educação do(a)s estudante acima citado(a)s.
                    </p>
                    <p className="text-justify leading-7 mt-8">
                        Sem mais para o momento, despedimo-nos.
                    </p>
                </div>
            );
        }
        if (type === 'termoUsoImagem') {
            return (
                <div className="section mt-4 space-y-6">
                    <p className="text-justify leading-7">
                        Eu, <strong>{responsavelNome || 'Não informado'}</strong> RG: <strong>{responsavelRg || 'Não informado'}</strong> e CPF: <strong>{cpf || 'Não informado'}</strong>, responsável pelo(a) estudante <strong>{estudanteNome}</strong> nascido em <strong>{dataNasc}</strong>, de nacionalidade BRASIL portador(a) da Cédula de Identidade RG nº <strong>{rg || 'Não informado'}</strong> e CPF nº <strong>{cpf || 'Não informado'}</strong> residente no endereço <strong>{enderecoCompleto}</strong>, menor de idade, AUTORIZO o uso de imagem, texto e voz para divulgação em diversas mídias on-line e off-line, incluindo TV, Rádio, Sites, Redes Sociais, dentre outras, do(a) menor aqui descrito.
                    </p>
                    <p className="text-justify leading-7">
                        A presente autorização é concedida a título gratuito, abrangendo o uso da imagem acima mencionada em todo território nacional e no exterior, sob qualquer forma e meios, sejam eles impressos, ou digitais e em toda e qualquer mídia.
                    </p>
                    <p className="text-justify leading-7">
                        Por esta ser a expressão da minha vontade declaro que autorizo o uso acima descrito da imagem do (a) menor, sem que nada haja a ser reclamado a título de direitos conexos à sua imagem ou a qualquer outro, e assino a presente autorização.
                    </p>
                </div>
            );
        }
        if (type === 'termoAutorizacaoTrajeto') {
            return (
                <div className="section mt-4 space-y-8">
                    <div className="grid grid-cols-1 gap-4">
                        <p className="flex items-center gap-2 border-b border-black pb-1">
                            <span className="font-bold whitespace-nowrap">ESCOLA:</span>
                            <span>ESCOLA MUNICIPAL DOM PAULO Mc HUGH</span>
                        </p>
                        <p className="flex items-center gap-2 border-b border-black pb-1">
                            <span className="font-bold whitespace-nowrap">Eu</span>
                            <span className="flex-1">{responsavelNome || '____________________________________________________________________'}</span>
                        </p>
                        <p className="flex items-center gap-2 border-b border-black pb-1">
                            <span className="font-bold whitespace-nowrap">Responsável pelo(a) estudante</span>
                            <span className="flex-1 font-bold">{estudanteNome}</span>
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <p className="flex items-center gap-2 border-b border-black pb-1">
                                <span className="font-bold whitespace-nowrap">da turma</span>
                                <span className="flex-1">{turmaNome} - {turmaSerie}</span>
                            </p>
                            <p className="flex items-center gap-2 border-b border-black pb-1 text-center">
                                <span className="font-bold whitespace-nowrap">no turno</span>
                                <span className="flex-1">{turmaTurno}</span>
                            </p>
                            <p className="flex items-center gap-2 border-b border-black pb-1">
                                <span className="font-bold whitespace-nowrap">Professor(a):</span>
                                <span className="flex-1">_________________________</span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <p className="font-bold">1- AUTORIZO MEU DEPENDENTE A FAZER O PERCURSO DA ESCOLA A PARA A RESIDÊNCIA:</p>
                        <div className="space-y-2 ml-4">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 border-2 border-black flex-shrink-0" />
                                <span className="pt-0.5">Acompanhado por menor.</span>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 border-2 border-black flex-shrink-0" />
                                <span className="pt-0.5">Desacompanhado</span>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 border-2 border-black flex-shrink-0" />
                                <div className="flex-1 flex flex-wrap items-end gap-2">
                                    <span className="pt-0.5">De condução escolar. Especificar nome (tipo):</span>
                                    <span className="flex-1 border-b border-black min-w-[200px]" />
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 border-2 border-black flex-shrink-0" />
                                <div className="flex-1 flex flex-wrap items-end gap-2">
                                    <span className="pt-0.5">Outros:</span>
                                    <span className="flex-1 border-b border-black min-w-[200px]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <p className="font-bold uppercase">2- Detalhar motivos diversos:</p>
                        <div className="w-full border-b border-black h-8" />
                        <div className="w-full border-b border-black h-8" />
                    </div>
                </div>
            );
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            printElement(printRef.current);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="no-print">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                {/* Documento imprimível */}
                <div ref={printRef} className="print-container bg-white text-black font-serif p-8 space-y-6 text-sm leading-relaxed">

                    {/* Cabeçalho */}
                    <div className="header text-center border-b-2 border-gray-800 pb-4">
                        <h1 className="text-base font-bold uppercase tracking-widest">Secretaria de Educação</h1>
                        <h2 className="text-sm text-gray-500 mt-1">Sistema de Ensino Público</h2>
                    </div>

                    {/* Título */}
                    <div className="title text-center text-xl font-bold uppercase underline tracking-widest my-6">
                        {title}
                    </div>

                    {/* Dados do Estudante */}
                    <div className="section">
                        <p className="section-title font-bold text-xs uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
                            I – Dados do Estudante
                        </p>
                        <div className="field-grid grid grid-cols-2 gap-x-6 gap-y-3">
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Nome Completo</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudanteNome}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Matrícula</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudanteMatricula}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Data de Nascimento</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{dataNasc}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Responsável</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{responsavelNome || 'Não informado'}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Turma</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{turmaNome || '-'}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Classificação</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{turmaSerie || '-'}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Ano Letivo</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{ano}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Endereço</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{enderecoCompleto}</p>
                            </div>
                        </div>
                    </div>

                    {renderTextContent()}

                    {/* Boletim - apenas para Declaração de Matrícula */}
                    {type === 'declaracaoMatricula' && notas.length > 0 && (
                        <div className="section mt-8">
                            <p className="section-title font-bold text-xs uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
                                II — Rendimento Escolar (Boletim)
                            </p>
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-left w-44">Componente Curricular</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">1º Bim</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">2º Bim</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">3º Bim</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">4º Bim</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-16">Média</th>
                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-24">Situação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notas.map((nota) => {
                                        const media = calcularMedia(nota);
                                        const sit = getSituacao(media);
                                        return (
                                            <tr key={nota.id}>
                                                <td className="border border-gray-300 p-1.5 text-left font-medium">{nota.componente}</td>
                                                <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_1)}</td>
                                                <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_2)}</td>
                                                <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_3)}</td>
                                                <td className="border border-gray-300 p-1.5 text-center">{fmtNota(nota.bimestre_4)}</td>
                                                <td className="border border-gray-300 p-1.5 text-center font-bold">{fmtNota(media)}</td>
                                                <td className="border border-gray-300 p-1.5 text-center font-semibold">
                                                    {sit}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}


                    {/* Assinaturas */}
                    <div className="assinatura flex justify-around mt-12 pb-6">
                        <div className="assinatura-linha text-center">
                            <p className="mb-8">{cidade ? `${cidade}, ` : ''}{hoje}</p>
                            <hr className="w-52 border-t border-gray-800 mb-1" />
                            <p className="text-xs">Diretor(a) da Escola</p>
                        </div>
                        {(type === 'termoCompromisso' || type === 'autorizacaoSaida') && (
                            <div className="assinatura-linha text-center">
                                <p className="mb-8">&nbsp;</p>
                                <hr className="w-52 border-t border-gray-800 mb-1" />
                                <p className="text-xs">
                                    {type === 'termoCompromisso' ? 'Estudante ou Responsável' : 'Assinatura do Responsável'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Rodapé */}
                    <div className="rodape text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-6">
                        <p>Documento emitido via sistema EducaFácil.</p>
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
