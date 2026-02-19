import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface Aluno {
  id: string;
  nome: string;
}

interface NotaCompleta {
  aluno_id: string;
  disciplina: string;
  media: number;
  faltas: number;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  serie: string;
  turno: string;
  capacidade: number;
}

const DISCIPLINAS = [
  'Língua Portuguesa', 'Arte', 'Educação Física', 'Língua Inglesa',
  'Matemática', 'Ciências', 'Geografia', 'História'
];

export default function AtaFinal() {
  const navigate = useNavigate();
  const { turmaId } = useParams();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [notas, setNotas] = useState<Record<string, NotaCompleta>>({});
  const [situacoes, setSituacoes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (turmaId) {
      loadData();
    }
  }, [turmaId]);

  async function loadData() {
    if (!turmaId) return;
    setLoading(true);

    try {
      const turmaDocRef = doc(db, 'turmas', turmaId);
      const turmaDoc = await getDoc(turmaDocRef);
      if (turmaDoc.exists()) {
        setTurma({ id: turmaDoc.id, ...turmaDoc.data() } as Turma);
      }

      const alunosQuery = query(collection(db, 'alunos'), where('turma_id', '==', turmaId), where('status', '==', 'Ativo'), orderBy('nome'));
      const alunosSnapshot = await getDocs(alunosQuery);
      const alunosData = alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aluno));
      setAlunos(alunosData);

      // NOTE: The following data for 'notas' and 'situacoes' is mocked for demonstration.
      // In a real application, you would fetch this data from Firestore.
      const notasMap: Record<string, NotaCompleta> = {};
      const situacoesMap: Record<string, string> = {};

      alunosData.forEach(aluno => {
        situacoesMap[aluno.id] = 'Aprovado';
        DISCIPLINAS.forEach(disc => {
          notasMap[`${aluno.id}-${disc}`] = {
            aluno_id: aluno.id,
            disciplina: disc,
            media: Math.round((Math.random() * 4 + 6) * 10) / 10,
            faltas: Math.floor(Math.random() * 10),
          };
        });
      });

      setNotas(notasMap);
      setSituacoes(situacoesMap);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    }

    setLoading(false);
  }

  function getMediaColor(media: number): string {
    if (media >= 7) return 'text-green-600';
    if (media >= 6) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getCapacidadeStatus() {
    const total = alunos.length;
    const capacidade = turma?.capacidade || 35;
    if (total <= capacidade) {
      return { text: 'Dentro da capacidade', color: 'text-green-600' };
    }
    return { text: 'Acima da capacidade', color: 'text-red-600' };
  }

  return (
    <AppLayout title={`Ata Final - ${turma?.nome || ''}`}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-muted-foreground">Resultados finais e frequência dos alunos</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/turmas')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Turmas
          </Button>

          <div className="flex-1" />

          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Gerar PDF
          </Button>

          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            {/* Header da Ata */}
            <div className="p-6 border-b bg-muted/30">
              <h2 className="text-xl font-bold text-center mb-6">ATA FINAL DO ENSINO FUNDAMENTAL</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <p><strong>INEP:</strong> ________________</p>
                  <p><strong>CURSO:</strong> ENSINO FUNDAMENTAL</p>
                  <p><strong>TURMA:</strong> {turma?.nome}</p>
                  <p><strong>Alunos Ativos:</strong> {alunos.length}</p>
                </div>
                <div className="space-y-2">
                  <p><strong>ESTABELECIMENTO DE ENSINO:</strong> ________________</p>
                  <p><strong>CLASSIFICAÇÃO:</strong> ________________</p>
                  <p><strong>TURNO:</strong> {turma?.turno}</p>
                </div>
                <div className="space-y-2">
                  <p><strong>MUNICÍPIO:</strong> Itacoatiara - AM</p>
                  <p><strong>AMPARO LEGAL:</strong> Res. nº 12/002 - CEE/AM</p>
                  <p><strong>ANO LETIVO:</strong> {turma?.ano}</p>
                  <p className="flex items-center gap-2">
                    <strong>Capacidade da Sala:</strong> {turma?.capacidade || 35}
                    <span className={`text-sm ${getCapacidadeStatus().color}`}>
                      Status: {getCapacidadeStatus().text}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela de Notas */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium" rowSpan={2}>Nº</th>
                    <th className="p-3 text-left font-medium" rowSpan={2}>NOME DO ALUNO(A)</th>
                    {DISCIPLINAS.map((disc) => (
                      <th key={disc} className="p-2 text-center font-medium border-l" colSpan={2}>
                        {disc}
                      </th>
                    ))}
                    <th className="p-3 text-center font-medium border-l" rowSpan={2}>SITUAÇÃO</th>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    {DISCIPLINAS.map((disc) => (
                      <>
                        <th key={`${disc}-res`} className="p-2 text-center text-xs border-l">Res</th>
                        <th key={`${disc}-fal`} className="p-2 text-center text-xs">Fal</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno, index) => (
                    <tr key={aluno.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{String(index + 1).padStart(2, '0')}</td>
                      <td className="p-3 font-medium">{aluno.nome}</td>
                      {DISCIPLINAS.map((disc) => {
                        const nota = notas[`${aluno.id}-${disc}`];
                        return (
                          <>
                            <td key={`${aluno.id}-${disc}-res`} className={`p-2 text-center border-l ${getMediaColor(nota?.media || 0)}`}>
                              {nota?.media?.toFixed(1) || '-'}
                            </td>
                            <td key={`${aluno.id}-${disc}-fal`} className="p-2 text-center">
                              {nota?.faltas || 0}
                            </td>
                          </>
                        );
                      })}
                      <td className="p-3 text-center border-l">
                        <Select 
                          value={situacoes[aluno.id]} 
                          onValueChange={(v) => setSituacoes(prev => ({ ...prev, [aluno.id]: v }))}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Aprovado">Aprovado</SelectItem>
                            <SelectItem value="Reprovado">Reprovado</SelectItem>
                            <SelectItem value="Transferido">Transferido</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legenda */}
            <div className="p-4 border-t bg-muted/30 text-sm text-muted-foreground">
              <p><strong>OBS:</strong> Res = Resultado (média dos bimestres) / Fal = Faltas (total anual por disciplina)</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}