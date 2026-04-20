import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { turmaRepo, estudanteRepo } from '@/repositories/CadastrosRepository';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface Estudante {
  id: string;
  nome: string;
}

interface NotaCompleta {
  estudante_id: string;
  componente: string;
  media: number;
  faltas: number;
  frequencia: number;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  serie: string;
  turno: string;
  capacidade: number;
}

// Dynamic components will be fetched from the turma object

export default function AtaFinal() {
  const navigate = useNavigate();
  const { turmaId } = useParams();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [Estudantes, setestudantes] = useState<Estudante[]>([]);
  const { escolaAtivaId } = useUserRole();
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
      // Offline-first: Tenta carregar do cache local via Repo
      if (escolaAtivaId) {
        await turmaRepo.seed(escolaAtivaId);
        await estudanteRepo.seed(turmaId, escolaAtivaId);
      }

      const turmaIdData = await turmaRepo.getById(turmaId);
      if (turmaIdData) {
        setTurma(turmaIdData as Turma);
      }

      const estudantesData = await estudanteRepo.getByTurma(turmaId);
      const filteredEstudantes = estudantesData.filter((e: any) => e.status === 'Frequentando' && !e.excluido);
      setestudantes(filteredEstudantes);

      // Fetch components from turma
      const componentesDaTurma = (turmaIdData.componentes || []) as any[];

      // Load all notes for this turma and year
      const currentYear = new Date().getFullYear();
      const notasQuery = query(
        collection(db, 'notas'),
        where('turma_id', '==', turmaId),
        where('ano', '==', currentYear)
      );
      const notasSnapshot = await getDocs(notasQuery);
      const fetchedNotasMap: Record<string, Record<string, any>> = {};
      notasSnapshot.forEach(doc => {
        const data = doc.data();
        if (!fetchedNotasMap[data.estudante_id]) fetchedNotasMap[data.estudante_id] = {};
        fetchedNotasMap[data.estudante_id][data.componente] = data;
      });

      // Load all frequencies for this turma
      const freqQuery = query(
        collection(db, 'frequencias'),
        where('turma_id', '==', turmaId)
      );
      const freqSnapshot = await getDocs(freqQuery);
      const faltasMap: Record<string, Record<string, number>> = {};
      freqSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'faltou') {
          if (!faltasMap[data.estudante_id]) faltasMap[data.estudante_id] = {};
          faltasMap[data.estudante_id][data.componente] = (faltasMap[data.estudante_id][data.componente] || 0) + 1;
        }
      });

      const processedNotas: Record<string, NotaCompleta> = {};
      const calculatedSituacoes: Record<string, string> = {};

      filteredEstudantes.forEach((estudante: any) => {
        let failsGrade = 0;
        let failsFreq = 0;

        componentesDaTurma.forEach(comp => {
          const compNota = fetchedNotasMap[estudante.id]?.[comp.nome];
          const media = compNota?.media_anual || 0;
          const faltas = faltasMap[estudante.id]?.[comp.nome] || 0;
          const carga = comp.cargaHoraria || 0;
          const freqPercent = carga > 0 ? ((carga - faltas) / carga) * 100 : 100;

          processedNotas[`${estudante.id}-${comp.nome}`] = {
            estudante_id: estudiante.id,
            componente: comp.nome,
            media: Number(media),
            faltas: Number(faltas),
            frequencia: freqPercent
          } as any;

          if (media < 6) failsGrade++;
          if (freqPercent < 75) failsFreq++;
        });

        // Business Rules:
        // Aprovado: media >= 6 and freq > 75 in ALL
        // Pendente: 1-2 medias < 6 and freq > 75 in ALL
        // Reprovado: medias < 6 in > 2 or freq < 75 in any
        
        if (failsGrade === 0 && failsFreq === 0) {
          calculatedSituacoes[estudante.id] = 'Aprovado';
        } else if (failsGrade <= 2 && failsFreq === 0) {
          calculatedSituacoes[estudante.id] = 'Pendente';
        } else {
          calculatedSituacoes[estudante.id] = 'Reprovado';
        }
      });

      setNotas(processedNotas);
      setSituacoes(calculatedSituacoes);

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
    const total = Estudantes.length;
    const capacidade = turma?.capacidade || 35;
    if (total <= capacidade) {
      return { text: 'Dentro da capacidade', color: 'text-green-600' };
    }
    return { text: 'Acima da capacidade', color: 'text-red-600' };
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Ata Final - {turma?.nome || ''}</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">Resultados finais e frequência dos Estudantes</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/turmas')} className="shrink-0 gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Voltar para Turmas</span>
            <span className="xs:hidden">Voltar</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
                  <p><strong>Estudantes Frequentando:</strong> {Estudantes.length}</p>
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
                    <th className="p-3 text-left font-medium" rowSpan={2}>NOME DO ESTUDANTE(A)</th>
                    {/* Dynamic Headers based on Turma Components */}
                    {(turma?.componentes || []).map((comp: any) => (
                      <th key={comp.id || comp.nome} className="p-2 text-center font-medium border-l" colSpan={2}>
                        {comp.nome}
                      </th>
                    ))}
                    <th className="p-3 text-center font-medium border-l" rowSpan={2}>SITUAÇÃO</th>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    {(turma?.componentes || []).map((comp: any) => (
                      <React.Fragment key={comp.id || comp.nome}>
                        <th className="p-2 text-center text-[10px] border-l uppercase">Res</th>
                        <th className="p-2 text-center text-[10px] uppercase">Fal</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Estudantes.map((estudante, index) => (
                    <tr key={estudante.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{String(index + 1).padStart(2, '0')}</td>
                      <td className="p-3 font-medium">{estudante.nome}</td>
                      {(turma?.componentes || []).map((comp: any) => {
                        const nota = notas[`${estudante.id}-${comp.nome}`];
                        const freqFail = (nota?.frequencia || 0) < 75;
                        const gradeFail = (nota?.media || 0) < 6;
                        
                        return (
                          <React.Fragment key={`${estudante.id}-${comp.nome}`}>
                            <td className={`p-2 text-center border-l ${gradeFail ? 'bg-red-50 text-red-600 font-bold' : ''}`}>
                              {nota ? nota.media.toFixed(1) : '-'}
                            </td>
                            <td className={`p-2 text-center ${freqFail ? 'bg-orange-50 text-orange-600 font-bold' : ''}`}>
                              <div className="flex flex-col items-center leading-tight">
                                <span>{nota?.faltas || 0}</span>
                                {nota && (
                                  <span className="text-[10px] opacity-70">
                                    {Math.round(nota.frequencia)}%
                                  </span>
                                )}
                              </div>
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="p-3 text-center border-l">
                        <Select
                          value={situacoes[estudante.id]}
                          onValueChange={(v) => setSituacoes(prev => ({ ...prev, [estudante.id]: v }))}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Aprovado">Aprovado</SelectItem>
                            <SelectItem value="Pendente">Pendente</SelectItem>
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
              <p><strong>OBS:</strong> Res = Resultado (média anual) / Fal = Faltas (total anual e % de frequência com base na carga horária)</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}