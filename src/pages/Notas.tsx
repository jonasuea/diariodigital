import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Users, FileText, Save, Edit } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

interface Nota {
  id?: string;
  aluno_id: string;
  turma_id: string;
  disciplina: string;
  bimestre_1: number | null;
  bimestre_2: number | null;
  bimestre_3: number | null;
  bimestre_4: number | null;
  media_anual?: number | null;
  situacao?: string | null;
}

interface Turma {
  id: string;
  nome: string;
}

const DISCIPLINAS = [
  'Língua Portuguesa',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Arte',
  'Educação Física',
  'Inglês',
  'Ensino Religioso',
  'Física',
  'Química',
  'Biologia',
  'Filosofia',
  'Sociologia',
];

const DEFAULT_BOLETIM_TEMPLATE = `BOLETIM ESCOLAR

Escola Municipal Dom Paulo McHugh
Ano Letivo: {ANO}

DADOS DO ALUNO:
Nome: {NOME_ALUNO}
Matrícula: {MATRICULA}
Turma: {TURMA}

RENDIMENTO ESCOLAR:
{NOTAS}

Média Geral: {MEDIA_GERAL}
Situação: {SITUACAO}

_______________________________
Diretor(a)

_______________________________
Coordenador(a) Pedagógico(a)

Data de emissão: {DATA_EMISSAO}`;

export default function Notas() {
  const navigate = useNavigate();
  const { turmaId } = useParams();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [notas, setNotas] = useState<Record<string, Record<string, Nota>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [disciplina, setDisciplina] = useState('todos');
  const [boletimDialogOpen, setBoletimDialogOpen] = useState(false);
  const [boletimTemplate, setBoletimTemplate] = useState(DEFAULT_BOLETIM_TEMPLATE);

  useEffect(() => {
    if (turmaId) {
      loadData();
    }
  }, [turmaId]);

  async function loadData() {
    if (!turmaId) return;
    setLoading(true);

    try {
      // Load turma
      const turmaDocRef = doc(db, 'turmas', turmaId);
      const turmaDoc = await getDoc(turmaDocRef);
      if (turmaDoc.exists()) {
        setTurma({ id: turmaDoc.id, ...turmaDoc.data() } as Turma);
      }

      // Load alunos da turma
      const alunosQuery = query(collection(db, 'alunos'), where('turma_id', '==', turmaId), where('status', 'in', ['Ativo', 'Frequentando']), orderBy('nome'));
      const alunosSnapshot = await getDocs(alunosQuery);
      const alunosData = alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aluno));
      setAlunos(alunosData);

      // Load notas
      const notasQuery = query(collection(db, 'notas'), where('turma_id', '==', turmaId));
      const notasSnapshot = await getDocs(notasQuery);
      const notasData = notasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nota));

      const notasMap: Record<string, Record<string, Nota>> = {};
      alunosData.forEach(aluno => {
        notasMap[aluno.id] = {};
        DISCIPLINAS.forEach(disc => {
          const existingNota = notasData?.find(n => n.aluno_id === aluno.id && n.disciplina === disc);
          notasMap[aluno.id][disc] = existingNota || {
            aluno_id: aluno.id,
            turma_id: turmaId,
            disciplina: disc,
            bimestre_1: null,
            bimestre_2: null,
            bimestre_3: null,
            bimestre_4: null,
          };
        });
      });
      setNotas(notasMap);

    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    }

    setLoading(false);
  }

  function updateNota(alunoId: string, disc: string, field: keyof Nota, value: number | null) {
    setNotas(prev => ({
      ...prev,
      [alunoId]: {
        ...prev[alunoId],
        [disc]: {
          ...prev[alunoId][disc],
          [field]: value
        }
      }
    }));
  }

  function calcularMedia(nota: Nota | undefined): number | null {
    if (!nota) return null;
    const { bimestre_1, bimestre_2, bimestre_3, bimestre_4 } = nota;
    if (bimestre_1 != null && bimestre_2 != null && bimestre_3 != null && bimestre_4 != null) {
      return Math.round(((bimestre_1 + bimestre_2 + bimestre_3 + bimestre_4) / 4) * 10) / 10;
    }
    return null;
  }

  function calcularSituacao(media: number | null): string {
    if (media === null) return 'Em andamento';
    return media >= 6 ? 'Aprovado' : 'Reprovado';
  }

  function getMediaColor(media: number | null): string {
    if (media === null) return 'bg-muted';
    if (media >= 7) return 'bg-green-100 text-green-800';
    if (media >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  function getSituacaoColor(situacao: string): string {
    switch (situacao) {
      case 'Aprovado': return 'text-green-600';
      case 'Reprovado': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  }

  async function handleSave() {
    if (disciplina === 'todos') {
      toast.error('Selecione uma disciplina para salvar as notas');
      return;
    }

    setSaving(true);
    try {
      for (const alunoId of Object.keys(notas)) {
        const nota = notas[alunoId][disciplina];
        if (nota) {
          const { id, ...notaData } = nota;
          if (id) {
            const notaDocRef = doc(db, 'notas', id);
            await updateDoc(notaDocRef, {
              bimestre_1: nota.bimestre_1,
              bimestre_2: nota.bimestre_2,
              bimestre_3: nota.bimestre_3,
              bimestre_4: nota.bimestre_4,
            });
          } else if (nota.bimestre_1 != null || nota.bimestre_2 != null || nota.bimestre_3 != null || nota.bimestre_4 != null) {
            await addDoc(collection(db, 'notas'), notaData);
          }
        }
      }
      toast.success('Notas salvas com sucesso!');
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar notas');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleGerarBoletins() {
    if (alunos.length === 0) {
      toast.error('Nenhum aluno encontrado');
      return;
    }

    const doc = new jsPDF();
    const ano = new Date().getFullYear();

    alunos.forEach((aluno, index) => {
      if (index > 0) doc.addPage();

      const alunoNotas = notas[aluno.id] || {};
      let notasTexto = '';
      let totalMedia = 0;
      let countMedia = 0;

      DISCIPLINAS.forEach(disc => {
        const nota = alunoNotas[disc];
        const media = calcularMedia(nota);
        if (nota && (nota.bimestre_1 != null || nota.bimestre_2 != null || nota.bimestre_3 != null || nota.bimestre_4 != null)) {
          notasTexto += `${disc}: 1º Bim: ${nota.bimestre_1?.toFixed(1) || '-'} | 2º Bim: ${nota.bimestre_2?.toFixed(1) || '-'} | 3º Bim: ${nota.bimestre_3?.toFixed(1) || '-'} | 4º Bim: ${nota.bimestre_4?.toFixed(1) || '-'} | Média: ${media?.toFixed(1) || '-'}\n`;
          if (media != null) {
            totalMedia += media;
            countMedia++;
          }
        }
      });

      const mediaGeral = countMedia > 0 ? (totalMedia / countMedia).toFixed(1) : '-';
      const situacao = countMedia > 0 && totalMedia / countMedia >= 6 ? 'Aprovado' : 'Em andamento';

      let conteudo = boletimTemplate
        .replace('{ANO}', ano.toString())
        .replace('{NOME_ALUNO}', aluno.nome)
        .replace('{MATRICULA}', aluno.matricula)
        .replace('{TURMA}', turma?.nome || '')
        .replace('{NOTAS}', notasTexto || 'Nenhuma nota registrada')
        .replace('{MEDIA_GERAL}', mediaGeral)
        .replace('{SITUACAO}', situacao)
        .replace('{DATA_EMISSAO}', new Date().toLocaleDateString('pt-BR'));

      const lines = doc.splitTextToSize(conteudo, 180);
      doc.setFontSize(12);
      doc.text(lines, 15, 20);
    });

    doc.save(`boletins-${turma?.nome}-${ano}.pdf`);
    toast.success('Boletins gerados com sucesso!');
  }

  const filteredAlunos = alunos.filter(a => 
    a.nome.toLowerCase().includes(search.toLowerCase())
  );

  const isInputDisabled = disciplina === 'todos';

  return (
    <AppLayout title={`Notas - ${turma?.nome || ''}`}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-muted-foreground">Lançamento e gerenciamento de notas bimestrais</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Turmas
          </Button>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar alunos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={disciplina} onValueChange={setDisciplina}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os componentes</SelectItem>
              {DISCIPLINAS.map(disc => (
                <SelectItem key={disc} value={disc}>{disc}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" className="gap-2" onClick={() => setBoletimDialogOpen(true)}>
            <Edit className="h-4 w-4" />
            Editar Modelo
          </Button>

          <Button variant="outline" className="gap-2" onClick={handleGerarBoletins}>
            <FileText className="h-4 w-4" />
            Gerar Boletins
          </Button>

          <Button onClick={handleSave} disabled={saving || isInputDisabled} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>

        {isInputDisabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
            Selecione uma disciplina específica para lançar notas. Com "Todos os componentes" selecionado, as notas são exibidas apenas para visualização.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Nome do Aluno</th>
                    {disciplina !== 'todos' && (
                      <>
                        <th className="text-center p-4 font-medium text-muted-foreground">1º Bimestre</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">2º Bimestre</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">3º Bimestre</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">4º Bimestre</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Média Anual</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Situação</th>
                      </>
                    )}
                    {disciplina === 'todos' && (
                      <>
                        <th className="text-center p-4 font-medium text-muted-foreground">Disciplinas com Notas</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Média Geral</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Situação</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAlunos.map((aluno) => {
                    if (disciplina !== 'todos') {
                      const nota = notas[aluno.id]?.[disciplina];
                      const media = calcularMedia(nota);
                      const situacao = calcularSituacao(media);
                      return (
                        <tr key={aluno.id} className="border-t">
                          <td className="p-4 font-medium">{aluno.nome}</td>
                          <td className="p-4">
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={nota?.bimestre_1 ?? ''}
                              onChange={(e) => updateNota(aluno.id, disciplina, 'bimestre_1', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-20 text-center mx-auto"
                              disabled={isInputDisabled}
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={nota?.bimestre_2 ?? ''}
                              onChange={(e) => updateNota(aluno.id, disciplina, 'bimestre_2', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-20 text-center mx-auto"
                              disabled={isInputDisabled}
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={nota?.bimestre_3 ?? ''}
                              onChange={(e) => updateNota(aluno.id, disciplina, 'bimestre_3', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-20 text-center mx-auto"
                              disabled={isInputDisabled}
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={nota?.bimestre_4 ?? ''}
                              onChange={(e) => updateNota(aluno.id, disciplina, 'bimestre_4', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-20 text-center mx-auto"
                              disabled={isInputDisabled}
                            />
                          </td>
                          <td className="p-4">
                            <div className={`w-20 py-2 rounded text-center mx-auto font-semibold ${getMediaColor(media)}`}>
                              {media !== null ? media.toFixed(1) : '-'}
                            </div>
                          </td>
                          <td className={`p-4 text-center font-medium ${getSituacaoColor(situacao)}`}>
                            {situacao}
                          </td>
                        </tr>
                      );
                    } else {
                      // Visualização de todos os componentes
                      const alunoNotas = notas[aluno.id] || {};
                      let disciplinasComNotas = 0;
                      let somaMedias = 0;
                      let countMedias = 0;

                      DISCIPLINAS.forEach(disc => {
                        const nota = alunoNotas[disc];
                        if (nota && (nota.bimestre_1 != null || nota.bimestre_2 != null || nota.bimestre_3 != null || nota.bimestre_4 != null)) {
                          disciplinasComNotas++;
                          const media = calcularMedia(nota);
                          if (media != null) {
                            somaMedias += media;
                            countMedias++;
                          }
                        }
                      });

                      const mediaGeral = countMedias > 0 ? somaMedias / countMedias : null;
                      const situacaoGeral = calcularSituacao(mediaGeral);

                      return (
                        <tr key={aluno.id} className="border-t">
                          <td className="p-4 font-medium">{aluno.nome}</td>
                          <td className="p-4 text-center">{disciplinasComNotas} de {DISCIPLINAS.length}</td>
                          <td className="p-4">
                            <div className={`w-20 py-2 rounded text-center mx-auto font-semibold ${getMediaColor(mediaGeral)}`}>
                              {mediaGeral !== null ? mediaGeral.toFixed(1) : '-'}
                            </div>
                          </td>
                          <td className={`p-4 text-center font-medium ${getSituacaoColor(situacaoGeral)}`}>
                            {situacaoGeral}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t p-4 bg-muted/30 flex justify-end gap-8 text-sm">
              <span>Total de alunos: {filteredAlunos.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para editar modelo do boletim */}
      <Dialog open={boletimDialogOpen} onOpenChange={setBoletimDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Modelo do Boletim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Variáveis disponíveis: {'{ANO}'}, {'{NOME_ALUNO}'}, {'{MATRICULA}'}, {'{TURMA}'}, {'{NOTAS}'}, {'{MEDIA_GERAL}'}, {'{SITUACAO}'}, {'{DATA_EMISSAO}'}
            </div>
            <Textarea
              value={boletimTemplate}
              onChange={(e) => setBoletimTemplate(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoletimTemplate(DEFAULT_BOLETIM_TEMPLATE)}>
              Restaurar Padrão
            </Button>
            <Button onClick={() => setBoletimDialogOpen(false)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
