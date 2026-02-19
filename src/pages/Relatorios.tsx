import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, BarChart3, FileText, Download, Edit, FileDown } from 'lucide-react';
import { ReportNotasDialog } from '@/components/relatorios/ReportNotasDialog';
import { ReportFrequenciaDialog } from '@/components/relatorios/ReportFrequenciaDialog';
import { ReportDesempenhoDialog } from '@/components/relatorios/ReportDesempenhoDialog';
import { ReportMatriculasDialog } from '@/components/relatorios/ReportMatriculasDialog';
import { ReportCapacidadeDialog } from '@/components/relatorios/ReportCapacidadeDialog';
import { ReportTransferenciasDialog } from '@/components/relatorios/ReportTransferenciasDialog';
import { DocumentTemplateDialog, DEFAULT_TEMPLATES } from '@/components/relatorios/DocumentTemplateDialog';
import { GenerateDocumentDialog } from '@/components/relatorios/GenerateDocumentDialog';

type ReportDialog = 'notas' | 'frequencia' | 'desempenho' | 'matriculas' | 'capacidade' | 'transferencias' | null;
type TemplateDialog = 'declaracaoMatricula' | 'termoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | null;

export default function Relatorios() {
  const [activeReportDialog, setActiveReportDialog] = useState<ReportDialog>(null);
  const [activeTemplateDialog, setActiveTemplateDialog] = useState<TemplateDialog>(null);
  const [activeGenerateDoc, setActiveGenerateDoc] = useState<TemplateDialog>(null);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const relatoriosAcademicos = [
    {
      id: 'notas' as const,
      title: 'Relatório de Notas por Turma',
      description: 'Consolidado de notas por turma e disciplina',
    },
    {
      id: 'frequencia' as const,
      title: 'Relatório de Frequência',
      description: 'Controle de presença dos alunos',
    },
    {
      id: 'desempenho' as const,
      title: 'Relatório de Desempenho',
      description: 'Análise do desempenho acadêmico',
    },
  ];

  const relatoriosAdministrativos = [
    {
      id: 'matriculas' as const,
      title: 'Relatório de Matrículas',
      description: 'Dados sobre matrículas realizadas',
    },
    {
      id: 'capacidade' as const,
      title: 'Relatório de Capacidade',
      description: 'Ocupação das salas de aula',
    },
    {
      id: 'transferencias' as const,
      title: 'Relatório de Transferências',
      description: 'Alunos transferidos no período',
    },
  ];

  const documentosTermos = [
    {
      id: 'declaracaoMatricula' as const,
      title: 'Declaração de Matrícula',
      description: 'Documento que comprova a matrícula do aluno - Modelos para impressão em papel timbrado',
    },
    {
      id: 'termoMatricula' as const,
      title: 'Termo de Matrícula',
      description: 'Termo oficial de matrícula do aluno - Modelos para impressão em papel timbrado',
    },
    {
      id: 'termoCompromisso' as const,
      title: 'Termo de Compromisso',
      description: 'Termo de compromisso e conduta do aluno - Modelos para impressão em papel timbrado',
    },
    {
      id: 'autorizacaoSaida' as const,
      title: 'Autorização de Saída',
      description: 'Autorização para atividades externas - Modelos para impressão em papel timbrado',
    },
  ];

  const handleSaveTemplate = (templateId: TemplateDialog, content: string) => {
    if (templateId) {
      setTemplates(prev => ({ ...prev, [templateId]: content }));
    }
  };

  const getTemplateTitle = (id: TemplateDialog) => {
    switch (id) {
      case 'declaracaoMatricula': return 'Declaração de Matrícula';
      case 'termoMatricula': return 'Termo de Matrícula';
      case 'termoCompromisso': return 'Termo de Compromisso';
      case 'autorizacaoSaida': return 'Autorização de Saída';
      default: return '';
    }
  };

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-8 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gere relatórios e gerencie modelos de documentos</p>

        {/* Relatórios Acadêmicos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Relatórios Acadêmicos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <h2 className="text-lg font-semibold">Documentos e Termos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentosTermos.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-2">{doc.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{doc.description}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => setActiveTemplateDialog(doc.id)}>
                      <Edit className="h-4 w-4" />
                      Editar Modelo
                    </Button>
                    <Button className="flex-1 gap-2" onClick={() => setActiveGenerateDoc(doc.id)}>
                      <FileDown className="h-4 w-4" />
                      Gerar
                    </Button>
                  </div>
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
      <ReportCapacidadeDialog 
        open={activeReportDialog === 'capacidade'} 
        onOpenChange={(open) => !open && setActiveReportDialog(null)} 
      />
      <ReportTransferenciasDialog 
        open={activeReportDialog === 'transferencias'} 
        onOpenChange={(open) => !open && setActiveReportDialog(null)} 
      />

      {/* Template Editor Dialogs */}
      {activeTemplateDialog && (
        <DocumentTemplateDialog
          open={!!activeTemplateDialog}
          onOpenChange={(open) => !open && setActiveTemplateDialog(null)}
          title={getTemplateTitle(activeTemplateDialog)}
          defaultTemplate={templates[activeTemplateDialog]}
          onSave={(content) => handleSaveTemplate(activeTemplateDialog, content)}
        />
      )}

      {/* Generate Document Dialogs */}
      {activeGenerateDoc && (
        <GenerateDocumentDialog
          open={!!activeGenerateDoc}
          onOpenChange={(open) => !open && setActiveGenerateDoc(null)}
          title={getTemplateTitle(activeGenerateDoc)}
          template={templates[activeGenerateDoc]}
        />
      )}
    </AppLayout>
  );
}
