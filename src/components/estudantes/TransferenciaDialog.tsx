import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { printContainer } from '@/lib/print-utils';

interface HistoricoDisciplina {
    id: string;
    nome: string;
    nota_b1: string;
    nota_b2: string;
    nota_b3: string;
    nota_b4: string;
    media_final: string;
}

interface HistoricoAnual {
    id: string;
    ano_letivo: string;
    serie: string;
    escola: string;
    componentes: HistoricoDisciplina[];
    concluido: boolean;
}

interface Estudante {
    nome: string;
    matricula: string;
    data_nascimento?: string;
    mae_nome?: string | null;
    pai_nome?: string | null;
    responsavel_nome?: string | null;
    responsavel_relacao?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    turma_nome?: string;
    turma_serie?: string;
    ano?: number;
    status?: string;
    historico_academico?: HistoricoAnual[];
}

interface TransferenciaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estudante: Estudante;
}

export function TransferenciaDialog({ open, onOpenChange, estudante }: TransferenciaDialogProps) {

    const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const dataNasc = estudante.data_nascimento
        ? format(parseISO(estudante.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })
        : 'Não informado';

    const endereco = [estudante.endereco, estudante.bairro, estudante.cidade, estudante.estado]
        .filter(Boolean)
        .join(', ') || 'Não informado';

    const responsavel =
        estudante.responsavel_nome ||
        estudante.mae_nome ||
        estudante.pai_nome ||
        'Não informado';

    const handlePrint = () => printContainer();

    const historico = estudante.historico_academico || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="no-print">
                    <DialogTitle>Guia de Transferência</DialogTitle>
                </DialogHeader>

                {/* Documento imprimível */}
                <div className="print-container bg-white text-black font-serif p-6 space-y-6 text-sm leading-relaxed">

                    {/* Cabeçalho */}
                    <div className="header text-center border-b-2 border-gray-800 pb-4">
                        <h1 className="text-base font-bold uppercase tracking-widest">Secretaria de Educação</h1>
                        <h2 className="text-sm text-gray-500 mt-1">Sistema de Ensino Público</h2>
                    </div>

                    {/* Título */}
                    <div className="title text-center text-xl font-bold uppercase underline tracking-widest my-4">
                        Guia de Transferência
                    </div>

                    {/* Dados do Estudante */}
                    <div className="section">
                        <p className="section-title font-bold text-xs uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
                            I – Dados do Estudante
                        </p>
                        <div className="field-grid grid grid-cols-2 gap-x-6 gap-y-3">
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Nome Completo</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.nome}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Matrícula</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.matricula}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Data de Nascimento</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{dataNasc}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Situação</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.status || 'Transferido'}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Responsável</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{responsavel}</p>
                            </div>
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Endereço</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{endereco}</p>
                            </div>
                            {estudante.turma_nome && estudante.turma_nome !== '-' && (
                                <>
                                    <div className="field">
                                        <p className="field-label text-xs text-gray-500 uppercase">Última Turma</p>
                                        <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.turma_nome}</p>
                                    </div>
                                    <div className="field">
                                        <p className="field-label text-xs text-gray-500 uppercase">Classificação</p>
                                        <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.turma_serie || '-'}</p>
                                    </div>
                                </>
                            )}
                            <div className="field">
                                <p className="field-label text-xs text-gray-500 uppercase">Ano Letivo</p>
                                <p className="field-value font-medium border-b border-dotted border-gray-300 pb-0.5">{estudante.ano || new Date().getFullYear()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Histórico Escolar */}
                    {historico.length > 0 && (
                        <div className="section">
                            <p className="section-title font-bold text-xs uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
                                II – Histórico Escolar
                            </p>
                            <div className="space-y-4">
                                {historico.map((ano) => (
                                    <div key={ano.id} className="historico-item border border-gray-200 rounded p-3">
                                        <div className="historico-header flex items-center gap-4 mb-2 flex-wrap">
                                            <span className="font-bold">{ano.ano_letivo}</span>
                                            {ano.serie && <span className="text-gray-600">Classificação: {ano.serie}</span>}
                                            {ano.escola && <span className="text-gray-600">Escola: {ano.escola}</span>}
                                            <span className={`text-xs border px-2 py-0.5 rounded ${ano.concluido ? 'border-green-600 text-green-700' : 'border-gray-400 text-gray-600'}`}>
                                                {ano.concluido ? 'Concluído' : 'Em andamento'}
                                            </span>
                                        </div>
                                        {ano.componentes && ano.componentes.filter(d => d.nome).length > 0 ? (
                                            <table className="w-full text-xs border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-left">Componente Curricular</th>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">1º Bim</th>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">2º Bim</th>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">3º Bim</th>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-14">4º Bim</th>
                                                        <th className="border border-gray-300 bg-gray-100 p-1.5 text-center w-16">Média Final</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ano.componentes.filter(d => d.nome).map((d) => (
                                                        <tr key={d.id}>
                                                            <td className="border border-gray-300 p-1.5 text-left">{d.nome}</td>
                                                            <td className="border border-gray-300 p-1.5 text-center">{d.nota_b1 || '-'}</td>
                                                            <td className="border border-gray-300 p-1.5 text-center">{d.nota_b2 || '-'}</td>
                                                            <td className="border border-gray-300 p-1.5 text-center">{d.nota_b3 || '-'}</td>
                                                            <td className="border border-gray-300 p-1.5 text-center">{d.nota_b4 || '-'}</td>
                                                            <td className="border border-gray-300 p-1.5 text-center font-semibold">{d.media_final || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Nenhum componente registrado para este ano.</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Texto declaratório */}
                    <div className="section mt-2">
                        <p className="text-justify leading-7">
                            Declaramos para os devidos fins que o(a) estudante <strong>{estudante.nome}</strong>,
                            portador(a) da matrícula <strong>{estudante.matricula}</strong>, esteve regularmente
                            matriculado(a) nesta instituição de ensino, tendo sido transferido(a) em conformidade
                            com a legislação vigente.
                        </p>
                    </div>

                    {/* Data e Assinaturas */}
                    <div className="assinatura flex justify-between mt-12">
                        <div className="assinatura-linha text-center">
                            <hr className="w-52 border-t border-gray-800 mb-1" />
                            <p className="text-xs">Diretor(a) da Escola</p>
                        </div>
                        <div className="assinatura-linha text-center">
                            <hr className="w-52 border-t border-gray-800 mb-1" />
                            <p className="text-xs">Secretário(a) Escolar</p>
                        </div>
                    </div>

                    {/* Rodapé */}
                    <div className="rodape text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-6">
                        <p>Documento emitido em {hoje} via sistema EducaFácil.</p>
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
