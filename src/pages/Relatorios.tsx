import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, BarChart3, FileText, Download, Edit, FileDown } from 'lucide-react';
import { ReportNotasDialog } from '@/components/relatorios/ReportNotasDialog';
import { ReportFrequenciaDialog } from '@/components/relatorios/ReportFrequenciaDialog';
import { ReportDesempenhoDialog } from '@/components/relatorios/ReportDesempenhoDialog';
import { ReportMatriculasDialog } from '@/components/relatorios/ReportMatriculasDialog';
import { DocumentTemplateDialog, DEFAULT_TEMPLATES } from '@/components/relatorios/DocumentTemplateDialog';
import { GenerateDocumentDialog } from '@/components/relatorios/GenerateDocumentDialog';
import { RelatorioReuniaoDialog } from '@/components/relatorios/RelatorioReuniaoDialog';
import { ReportLotacaoDialog } from '@/components/relatorios/ReportLotacaoDialog';
import { ReportPSEDialog } from '@/components/relatorios/ReportPSEDialog';
import { ReportContatoPaisDialog } from '@/components/relatorios/ReportContatoPaisDialog';
import { ReportAtaFinalDialog } from '@/components/relatorios/ReportAtaFinalDialog';
import { DocumentPrintDialog } from '@/components/relatorios/DocumentPrintDialog';
import { ReportProfessoresDialog } from '@/components/relatorios/ReportProfessoresDialog';

type ReportDialog = 'notas' | 'frequencia' | 'desempenho' | 'matriculas' | 'reuniao' | 'lotacao' | 'pse' | 'contatoPais' | 'ataFinal' | 'professores' | null;
type TemplateDialog = 'declaracaoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | 'declaracaoComparecimento' | 'termoUsoImagem' | 'termoAutorizacaoTrajeto' | null;

export default function Relatorios() {
  const [activeReportDialog, setActiveReportDialog] = useState<ReportDialog>(null);
  const [activeGenerateDoc, setActiveGenerateDoc] = useState<TemplateDialog>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const relatoriosAcademicos = [
    {
      id: 'notas' as const,
      title: 'Relatório de Notas por Turma',
      description: 'Consolidado de notas por turma e componente',
    },
    {
      id: 'frequencia' as const,
      title: 'Relatório de Frequência',
      description: 'Controle de presença dos estudantes',
    },
    {
      id: 'desempenho' as const,
      title: 'Relatório de Desempenho',
      description: 'Análise do desempenho acadêmico',
    },
    {
      id: 'reuniao' as const,
      title: 'Controle de Reunião',
      description: 'Lista de presença e assinatura para reuniões de pais',
    },
    {
      id: 'ataFinal' as const,
      title: 'Ata Final',
      description: 'Consolidado final de notas e faltas por disciplina',
    },
  ];

  const relatoriosAdministrativos = [
    {
      id: 'matriculas' as const,
      title: 'Relatório de Matrículas',
      description: 'Dados sobre matrículas realizadas',
    },
    {
      id: 'lotacao' as const,
      title: 'Relatório de Lotação',
      description: 'Disciplinas ministradas por professor',
    },
    {
      id: 'pse' as const,
      title: 'Relatório do PSE',
      description: 'Programa Saúde na Escola - Dados do Aluno e SUS',
    },
    {
      id: 'contatoPais' as const,
      title: 'Relatório de Contato',
      description: 'Contatos dos pais ou responsáveis',
    },
    {
      id: 'professores' as const,
      title: 'Lista de Professores',
      description: 'Lista de professores com opção de incluir turmas e disciplinas',
    },
  ];

  const documentosTermos = [
    {
      id: 'declaracaoMatricula' as const,
      title: 'Declaração de Matrícula',
      description: 'Documento que comprova a matrícula do estudante com histórico de notas.',
    },
    {
      id: 'termoCompromisso' as const,
      title: 'Termo de Compromisso',
      description: 'Termo de compromisso e conduta do estudante e responsável.',
    },
    {
      id: 'autorizacaoSaida' as const,
      title: 'Autorização de Saída',
      description: 'Autorização permanente ou temporária para saída da instituição.',
    },
    {
      id: 'declaracaoComparecimento' as const,
      title: 'Declaração de Comparecimento',
      description: 'Documento para comprovar comparecimento do responsável em reunião de pais.',
    },
    {
      id: 'termoUsoImagem' as const,
      title: 'Termo de Autorização de Uso de Imagem',
      description: 'Autorização do responsável para uso de imagem, voz e texto do estudante.',
    },
    {
      id: 'termoAutorizacaoTrajeto' as const,
      title: 'Termo de Autorização de Trajeto',
      description: 'Autorização para o estudante realizar o percurso entre a escola e a residência.',
    },
  ];

  const getTemplateTitle = (id: TemplateDialog) => {
    switch (id) {
      case 'declaracaoMatricula': return 'Declaração de Matrícula';
      case 'termoCompromisso': return 'Termo de Compromisso';
      case 'autorizacaoSaida': return 'Autorização de Saída';
      case 'declaracaoComparecimento': return 'Declaração de Comparecimento';
      case 'termoUsoImagem': return 'Termo de Autorização de Uso de Imagem';
      case 'termoAutorizacaoTrajeto': return 'Termo de Autorização de Trajeto';
      default: return '';
    }
  };

  const handleGenerateData = (data: any) => {
    setPrintData(data);
    setIsPrintOpen(true);
  };

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-8 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gere relatórios acadêmicos e administrativos</p>

        {/* Relatórios Acadêmicos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Relatórios Acadêmicos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {relatoriosAcademicos.map((rel) => (
              <Card key={rel.id}>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-2">{rel.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{rel.description}</p>
                  <Button className="w-full gap-2" onClick={() => setActiveReportDialog(rel.id)}>
                    <Download className="h-4 w-4" />
                    Gerar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Relatórios Administrativos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Relatórios Administrativos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {relatoriosAdministrativos.map((rel) => (
              <Card key={rel.id}>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-2">{rel.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{rel.description}</p>
                  <Button className="w-full gap-2" onClick={() => setActiveReportDialog(rel.id)}>
                    <Download className="h-4 w-4" />
                    Gerar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Documentos e Termos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Documentos e Termos do Estudante</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {documentosTermos.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-2">{doc.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{doc.description}</p>
                  <Button className="w-full gap-2" onClick={() => setActiveGenerateDoc(doc.id)}>
                    <FileDown className="h-4 w-4" />
                    Selecionar Estudante e Gerar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* Report Dialogs */}
      <ReportNotasDialog
        open={activeReportDialog === 'notas'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportFrequenciaDialog
        open={activeReportDialog === 'frequencia'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportDesempenhoDialog
        open={activeReportDialog === 'desempenho'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportMatriculasDialog
        open={activeReportDialog === 'matriculas'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <RelatorioReuniaoDialog
        open={activeReportDialog === 'reuniao'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportLotacaoDialog
        open={activeReportDialog === 'lotacao'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportPSEDialog
        open={activeReportDialog === 'pse'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportContatoPaisDialog
        open={activeReportDialog === 'contatoPais'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportAtaFinalDialog
        open={activeReportDialog === 'ataFinal'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />
      <ReportProfessoresDialog
        open={activeReportDialog === 'professores'}
        onOpenChange={(open) => !open && setActiveReportDialog(null)}
      />

      {/* Selection Dialog */}
      {activeGenerateDoc && (
        <GenerateDocumentDialog
          open={!!activeGenerateDoc}
          onOpenChange={(open) => !open && setActiveGenerateDoc(null)}
          title={getTemplateTitle(activeGenerateDoc)}
          type={activeGenerateDoc}
          onGenerate={handleGenerateData}
        />
      )}

      {/* Print View Dialog */}
      {printData && (
        <DocumentPrintDialog
          open={isPrintOpen}
          onOpenChange={setIsPrintOpen}
          title={getTemplateTitle(printData.type)}
          type={printData.type}
          estudanteNome={printData.studentData.nome}
          estudanteMatricula={printData.studentData.matricula}
          estudanteNascimento={printData.studentData.data_nascimento}
          rg={printData.studentData.rg}
          cpf={printData.studentData.cpf}
          responsavelNome={printData.studentData.responsavel_nome || printData.studentData.mae_nome || printData.studentData.pai_nome}
          responsavelRg={printData.studentData.responsavel_rg}
          endereco={printData.studentData.endereco}
          bairro={printData.studentData.bairro}
          cidade={printData.studentData.cidade}
          estado={printData.studentData.estado}
          turmaNome={printData.turma?.nome}
          turmaSerie={printData.turma?.serie}
          turmaTurno={printData.turma?.turno}
          ano={printData.ano}
          notas={printData.notas}
        />
      )}
    </AppLayout>
  );
}
