import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Users, FileText, Save, Edit } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Estudante {
  id: string;
  nome: string;
  matricula: string;
}

interface Nota {
  id?: string;
  estudante_id: string;
  turma_id: string;
  componente: string;
  ano?: number; // added for year filtering
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
  componentes?: { nome: string; professorId: string }[];
}

const DEFAULT_BOLETIM_TEMPLATE = `BOLETIM ESCOLAR

Escola Municipal Dom Paulo McHugh
Ano Letivo: {ANO}

DADOS DO ESTUDANTE:
Nome: {NOME_ESTUDANTE}
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
  const [searchParams] = useSearchParams();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  // Correção do tipo do estado para suportar a estrutura aninhada: estudante -> componente -> nota
  const [notas, setNotas] = useState<Record<string, Record<string, Nota>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState('');
  const [componente, setDisciplina] = useState(searchParams.get('componente') || 'todos');
  const [boletimDialogOpen, setBoletimDialogOpen] = useState(false);
  const [boletimTemplate, setBoletimTemplate] = useState(DEFAULT_BOLETIM_TEMPLATE);

  const isComponenteFixo = !!searchParams.get('componente');
  const origem = searchParams.get('origem');

  const componentesDaTurma = turma?.componentes?.filter(c => c.professorId) || [];

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

      // Load Estudantes da turma
      const estudantesQuery = query(collection(db, 'estudantes'), where('turma_id', '==', turmaId), where('status', 'in', ['Ativo', 'Frequentando']), orderBy('nome'));
      const estudantesSnapshot = await getDocs(estudantesQuery);
      const estudantesData = estudantesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estudante));
      setEstudantes(estudantesData.sort((a, b) => a.nome.localeCompare(b.nome)));

      // Carregar notas do ano corrente
      const currentYear = new Date().getFullYear();
      const notasQuery = query(
        collection(db, 'notas'),
        where('turma_id', '==', turmaId),
        where('ano', '==', currentYear)
      );
      const notasSnapshot = await getDocs(notasQuery);
      const notasData: Record<string, Record<string, Nota>> = {};
      
      // ensure ano field exists on each document
      for (const docSnap of notasSnapshot.docs) {
        const data = docSnap.data();
        const estudanteId = data.estudante_id;

        // if ano is missing, persist current year
        if (data.ano == null) {
          updateDoc(doc(db, 'notas', docSnap.id), { ano: currentYear }).catch(console.error);
          data.ano = currentYear;
        }

        if (!notasData[estudanteId]) {
          notasData[estudanteId] = {};
        }

        notasData[estudanteId][data.componente] = { id: docSnap.id, ...data } as Nota;
      }

      setNotas(notasData);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    }

    setLoading(false);
  }

  function updateNota(estudanteId: string, disc: string, field: keyof Nota, value: number | null) {
    setNotas(prev => {
      const estudanteNotas = prev[estudanteId] || {};
      const disciplinaNota = estudanteNotas[disc] || {
        estudante_id: estudanteId,
        turma_id: turmaId!,
        componente: disc,
        bimestre_1: null,
        bimestre_2: null,
        bimestre_3: null,
        bimestre_4: null,
      };

      return {
        ...prev,
        [estudanteId]: {
          ...estudanteNotas,
          [disc]: {
            ...disciplinaNota,
            [field]: value
          }
        }
      };
    });
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
    if (componente === 'todos') {
      toast.error('Selecione uma componente para salvar as notas');
      return;
    }

    setSaving(true);
    try {
      // Iterar sobre todos os estudantes para salvar as notas da componente selecionada
      for (const estudanteId of Object.keys(notas)) {
        const nota = notas[estudanteId]?.[componente];
        if (nota) {
          const { id, ...notaData } = nota;
          // Apenas salvar se houver alguma nota lançada ou se já existir um ID (edição)
          const temNotaLancada = nota.bimestre_1 != null || nota.bimestre_2 != null || nota.bimestre_3 != null || nota.bimestre_4 != null;
          
          if (id) {
            const notaDocRef = doc(db, 'notas', id);
            await updateDoc(notaDocRef, {
              bimestre_1: nota.bimestre_1,
              bimestre_2: nota.bimestre_2,
              bimestre_3: nota.bimestre_3,
              bimestre_4: nota.bimestre_4,
              ano: new Date().getFullYear(), // keep year in sync
            });
          } else if (temNotaLancada) {
            // Se for um novo registro, garantir que todos os campos obrigatórios estejam presentes
            const currentYear = new Date().getFullYear();
            await addDoc(collection(db, 'notas'), {
              ...notaData,
              estudante_id: estudanteId,
              turma_id: turmaId!,
              componente: componente,
              ano: currentYear,
            });
          }
        }
      }
      await logActivity(`salvou as notas de "${componente}" para a turma "${turma?.nome}".`);
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
    if (estudantes.length === 0) {
      toast.error('Nenhum estudante encontrado');
      return;
    }

    const doc = new jsPDF();
    const ano = new Date().getFullYear();

    estudantes.forEach((estudante, index) => {
      if (index > 0) doc.addPage();

      const estudanteNotas = notas[estudante.id] || {};
      let notasTexto = '';
      let totalMedia = 0;
      let countMedia = 0;

      componentesDaTurma.forEach(comp => {
        const disc = comp.nome;
        const nota = estudanteNotas[disc];
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
        .replace('{NOME_ESTUDANTE}', estudante.nome)
        .replace('{MATRICULA}', estudante.matricula)
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

  const filteredEstudantes = estudantes.filter(a => 
    a.nome.toLowerCase().includes(search.toLowerCase())
  );

  const isInputDisabled = componente === 'todos';

  return (
    <AppLayout title={`Notas da Turma ${turma?.nome || ''}`}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-muted-foreground">Lançamento e gerenciamento de notas bimestrais</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => navigate(origem === 'diario' ? '/diario-digital' : '/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {origem === 'diario' ? 'Voltar para Diário Digital' : 'Voltar para Turmas'}
          </Button>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar Estudantes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={componente} onValueChange={setDisciplina} disabled={isComponenteFixo}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os componentes</SelectItem>
              {/* Popula o Select com os componentes da turma */}
              {componentesDaTurma.map(comp => (
                <SelectItem key={comp.nome} value={comp.nome}>{comp.nome}</SelectItem>
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

          {/* botão temporário para apagar todas as notas do banco */}
          <Button
            variant="destructive"
            size="sm"
            disabled={clearing}
            onClick={async () => {
              if (!window.confirm('Tem certeza de que deseja apagar **todas** as notas? Esta ação não pode ser desfeita.')) return;
              setClearing(true);
              try {
                const snapshot = await getDocs(collection(db, 'notas'));
                await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'notas', d.id))));
                toast.success('Todas as notas foram excluídas.');
                loadData();
              } catch (err) {
                console.error(err);
                toast.error('Erro ao apagar notas');
              } finally {
                setClearing(false);
              }
            }}
          >
            Limpar todas
          </Button>
        </div>

        {isInputDisabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
            Selecione uma componente específica para lançar notas. Com "Todos os componentes" selecionado, as notas são exibidas apenas para visualização.
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
                    <th className="p-3 text-left font-medium min-w-[200px]">Estudante</th>
                    {componente === 'todos' ? (
                      <>
                        <th className="p-3 text-center font-medium" colSpan={4}>Resumo Geral</th>
                        <th className="p-3 text-center font-medium w-28">Média Geral</th>
                        <th className="p-3 text-center font-medium w-28">Situação Final</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 text-center font-medium w-24">1º Bimestre</th>
                        <th className="p-3 text-center font-medium w-24">2º Bimestre</th>
                        <th className="p-3 text-center font-medium w-24">3º Bimestre</th>
                        <th className="p-3 text-center font-medium w-24">4º Bimestre</th>
                        <th className="p-3 text-center font-medium w-28">Média Anual</th>
                        <th className="p-3 text-center font-medium w-28">Situação</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredEstudantes.map((estudante) => {
                    if (componente === 'todos') {
                      const estudanteNotas = notas[estudante.id] || {};
                      const mediasDasDisciplinas = Object.values(estudanteNotas)
                        .map(nota => calcularMedia(nota))
                        .filter((media): media is number => media !== null);
                      
                      const mediaGeral = mediasDasDisciplinas.length > 0
                        ? mediasDasDisciplinas.reduce((acc, curr) => acc + curr, 0) / mediasDasDisciplinas.length
                        : null;
                      
                      const situacaoGeral = calcularSituacao(mediaGeral);

                      return (
                        <tr key={estudante.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{estudante.nome}</div>
                            <div className="text-xs text-muted-foreground">{estudante.matricula}</div>
                          </td>
                          <td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">-</td>
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
                    } else {
                      const nota = notas[estudante.id]?.[componente] || {};
                      const media = calcularMedia(nota);
                      const situacao = calcularSituacao(media);
                      return (
                        <tr key={estudante.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{estudante.nome}</div>
                            <div className="text-xs text-muted-foreground">{estudante.matricula}</div>
                          </td>
                          <td className="p-4">
                            <Input type="number" min="0" max="10" step="0.1" value={nota?.bimestre_1 ?? ''} onChange={(e) => updateNota(estudante.id, componente, 'bimestre_1', e.target.value ? parseFloat(e.target.value) : null)} className="w-20 text-center mx-auto" disabled={isInputDisabled} />
                          </td>
                          <td className="p-4">
                            <Input type="number" min="0" max="10" step="0.1" value={nota?.bimestre_2 ?? ''} onChange={(e) => updateNota(estudante.id, componente, 'bimestre_2', e.target.value ? parseFloat(e.target.value) : null)} className="w-20 text-center mx-auto" disabled={isInputDisabled} />
                          </td>
                          <td className="p-4">
                            <Input type="number" min="0" max="10" step="0.1" value={nota?.bimestre_3 ?? ''} onChange={(e) => updateNota(estudante.id, componente, 'bimestre_3', e.target.value ? parseFloat(e.target.value) : null)} className="w-20 text-center mx-auto" disabled={isInputDisabled} />
                          </td>
                          <td className="p-4">
                            <Input type="number" min="0" max="10" step="0.1" value={nota?.bimestre_4 ?? ''} onChange={(e) => updateNota(estudante.id, componente, 'bimestre_4', e.target.value ? parseFloat(e.target.value) : null)} className="w-20 text-center mx-auto" disabled={isInputDisabled} />
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
                    }
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t p-4 bg-muted/30 flex justify-end gap-8 text-sm">
              <span>Total de Estudantes: {filteredEstudantes.length}</span>
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
              Variáveis disponíveis: {'{ANO}'}, {'{NOME_ESTUDANTE}'}, {'{MATRICULA}'}, {'{TURMA}'}, {'{NOTAS}'}, {'{MEDIA_GERAL}'}, {'{SITUACAO}'}, {'{DATA_EMISSAO}'}
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
