import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface DocumentTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultTemplate: string;
  onSave: (template: string) => void;
}

const VARIABLES = [
  { name: '[NOME_ALUNO]', description: 'Nome do aluno' },
  { name: '[RG_ALUNO]', description: 'RG do aluno' },
  { name: '[CPF_ALUNO]', description: 'CPF do aluno' },
  { name: '[TURMA]', description: 'Nome da turma' },
  { name: '[ANO_SERIE]', description: 'Ano/Série' },
  { name: '[ANO_LETIVO]', description: 'Ano letivo' },
  { name: '[TURNO]', description: 'Turno' },
  { name: '[DATA]', description: 'Data atual' },
  { name: '[CIDADE]', description: 'Cidade' },
  { name: '[NOME_DIRETOR]', description: 'Nome do diretor' },
  { name: '[NOME_RESPONSAVEL]', description: 'Nome do responsável' },
  { name: '[DATA_NASCIMENTO]', description: 'Data de nascimento' },
  { name: '[NOME_PAI]', description: 'Nome do pai' },
  { name: '[NOME_MAE]', description: 'Nome da mãe' },
  { name: '[NATURALIDADE]', description: 'Naturalidade' },
  { name: '[NIVEL_ENSINO]', description: 'Nível de ensino' },
];

export function DocumentTemplateDialog({ open, onOpenChange, title, defaultTemplate, onSave }: DocumentTemplateDialogProps) {
  const [template, setTemplate] = useState(defaultTemplate);

  useEffect(() => {
    setTemplate(defaultTemplate);
  }, [defaultTemplate, open]);

  const handleSave = () => {
    onSave(template);
    toast.success('Modelo salvo com sucesso!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Modelo - {title}</DialogTitle>
          <DialogDescription>
            Edite o modelo do documento. Use variáveis como [NOME_ALUNO], [TURMA], [DATA] etc. Este modelo será usado para impressão em papel timbrado.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Textarea 
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Digite o modelo do documento..."
          />

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Variáveis disponíveis:</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {VARIABLES.map(v => (
                <div key={v.name} className="text-muted-foreground">
                  {v.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DEFAULT_TEMPLATES = {
  declaracaoMatricula: `DECLARAÇÃO DE MATRÍCULA

Declaro para os devidos fins que o(a) aluno(a) [NOME_ALUNO], portador(a) do RG nº [RG_ALUNO] e CPF nº [CPF_ALUNO], está devidamente matriculado(a) nesta instituição de ensino no [ANO_SERIE] do Ensino [NIVEL_ENSINO], no ano letivo de [ANO_LETIVO], turno [TURNO].

[CIDADE], [DATA]

_________________________________
[NOME_DIRETOR]
Diretor(a)`,

  termoMatricula: `TERMO DE MATRÍCULA

Pelo presente termo, fica matriculado(a) nesta instituição o(a) aluno(a) [NOME_ALUNO], filho(a) de [NOME_PAI] e [NOME_MAE], nascido(a) em [DATA_NASCIMENTO], natural de [NATURALIDADE], portador(a) do RG nº [RG_ALUNO] e CPF nº [CPF_ALUNO].

Série/Ano: [ANO_SERIE]
Turma: [TURMA]
Turno: [TURNO]
Ano Letivo: [ANO_LETIVO]

[CIDADE], [DATA]

_________________________________          _________________________________
Responsável pela Matrícula                 Responsável pelo Aluno`,

  termoCompromisso: `TERMO DE COMPROMISSO E CONDUTA

O(A) aluno(a) [NOME_ALUNO], matriculado(a) no [ANO_SERIE] da turma [TURMA], e seu responsável [NOME_RESPONSAVEL], comprometem-se a:

1. Respeitar as normas da instituição;
2. Zelar pelo patrimônio escolar;
3. Manter assiduidade e pontualidade;
4. Cumprir as atividades pedagógicas;
5. Participar das reuniões quando convocado.

[CIDADE], [DATA]

_________________________________          _________________________________
Aluno(a)                                   Responsável`,

  autorizacaoSaida: `AUTORIZAÇÃO PARA ATIVIDADE EXTERNA

Eu, [NOME_RESPONSAVEL], responsável pelo(a) aluno(a) [NOME_ALUNO], da turma [TURMA], autorizo sua participação na atividade externa denominada "[ATIVIDADE]", que ocorrerá em [DATA_ATIVIDADE], das [HORARIO_INICIO] às [HORARIO_FIM], no local [LOCAL_ATIVIDADE].

Declaro estar ciente dos riscos e responsabilidades envolvidas.

[CIDADE], [DATA]

_________________________________
Assinatura do Responsável`,
};
