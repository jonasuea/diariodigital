import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Contact,
  Download,
  FileText,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  Phone,
  User as UserIcon,
  FileDown
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  // Tentativa genérica
  const genericDate = new Date(dateVal);
  return isValid(genericDate) ? genericDate : null;
};

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { TransferenciaDialog } from '@/components/estudantes/TransferenciaDialog';
import { BoletimDialog } from '@/components/estudantes/BoletimDialog';
import { DocumentPrintDialog } from '@/components/relatorios/DocumentPrintDialog';
import { useUserRole } from '@/hooks/useUserRole';

// Interfaces
interface Estudante {
  id: string;
  nome: string;
  matricula: string;
  data_nascimento: string;
  status: string;
  foto_url: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cpf?: string | null;
  rg?: string | null;
  contato?: string | null;
  email?: string | null;
  mae_nome: string | null;
  mae_contato: string | null;
  pai_nome: string | null;
  pai_contato: string | null;
  email_responsavel?: string | null;
  pasta: string | null;
  prateleira: string | null;
  farda_tamanho: string | null;

  turma_id: string | null;
  ano: number;
  turma_nome?: string;
  turma_serie?: string;
  turma_turno?: string;
  historico_academico?: HistoricoAnual[];
  // responsável adicional
  responsavel_relacao?: string;
  responsavel_nome?: string;
  responsavel_rg?: string;
  responsavel_contato?: string;
  responsavel_email?: string;
  responsavel_cpf?: string;
  estudante_pcd?: boolean;
  deficiencias?: string[];
  estudante_aee?: boolean;
  cid_aee?: string;
  laudo_aee_url?: string;
}

interface Nota {
  id: string;
  componente: string;
  bimestre_1: number | null;
  bimestre_2: number | null;
  bimestre_3: number | null;
  bimestre_4: number | null;
  media_anual: number | null;
  situacao: 'Aprovado' | 'Reprovado' | 'Recuperação' | 'Cursando' | string | null;
  professorId?: string;
  professor_nome?: string;
}

interface Frequencia {
  status: 'presente' | 'faltou' | 'justificado';
  justificativa?: string;
}

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

// Componente Principal
export default function PerfilEstudante() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [estudante, setEstudante] = useState<Estudante | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [faltasAnuais, setFaltasAnuais] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('notas');
  const [turmaComponentes, setTurmaComponentes] = useState<any[]>([]);
  const [turmaHistorica, setTurmaHistorica] = useState<{ nome: string; serie: string }>({ nome: '-', serie: '' });
  const [transferenciaDialogOpen, setTransferenciaDialogOpen] = useState(false);
  const [boletimDialogOpen, setBoletimDialogOpen] = useState(false);
  const [printDocOpen, setPrintDocOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<'declaracaoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | 'declaracaoComparecimento' | 'termoUsoImagem' | 'termoAutorizacaoTrajeto'>('declaracaoMatricula');
  const [printDocTitle, setPrintDocTitle] = useState('');
  const { role } = useUserRole();

  // helper to display notes with one decimal or blank
  const formatNota = (n?: number | null) => {
    return n !== undefined && n !== null ? n.toFixed(1) : '';
  };

  useEffect(() => {
    if (id) {
      loadEstudanteData();
    }
  }, [id]);

  async function loadEstudanteData() {
    if (!id) return;
    setLoading(true);

    try {
      const estudanteDocRef = doc(db, 'estudantes', id);
      const estudanteDoc = await getDoc(estudanteDocRef);

      if (!estudanteDoc.exists()) {
        toast.error('Estudante não encontrado');
        navigate(-1);
        return;
      }

      const estudanteData = estudanteDoc.data() as Omit<Estudante, 'id'>;
      let turma_nome = '-';
      let turma_serie = '';
      let componentes: any[] = [];
      if (estudanteData.turma_id) {
        const turmaRef = doc(db, 'turmas', estudanteData.turma_id);
        const turmaDoc = await getDoc(turmaRef);
        if (turmaDoc.exists()) {
          const turmaData = turmaDoc.data();
          turma_nome = turmaData.nome;
          turma_serie = turmaData.serie || '';
          componentes = turmaData.componentes || [];
          estudanteData.turma_turno = turmaData.turno || '';
        }
      }

      setEstudante({ id: estudanteDoc.id, ...estudanteData, turma_nome, turma_serie });
      setTurmaComponentes(componentes);

      // Carrega notas e frequência em paralelo sempre que a página abre
      await Promise.all([
        loadNotasData(id, selectedYear, estudanteData.turma_id, componentes),
        loadFrequenciaData(id, selectedYear),
      ]);

    } catch (error) {
      toast.error('Sem permissão para carregar dados do estudante');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (estudante && id && activeTab === 'notas') {
      loadNotasData(id, selectedYear, estudante.turma_id, turmaComponentes);
    }
  }, [id, estudante, activeTab, selectedYear, turmaComponentes]);

  useEffect(() => {
    if (estudante && id && activeTab === 'frequencia') {
      loadFrequenciaData(id, selectedYear);
    }
  }, [id, estudante, activeTab, selectedYear]);

  async function loadNotasData(estudanteId: string, ano: string, turmaId: string | null, turmaComponentes: any[] = []) {
    try {
      const [professoresSnap, turmasSnap] = await Promise.all([
        getDocs(collection(db, 'professores')),
        getDocs(collection(db, 'turmas'))
      ]);
      const professoresMap = new Map(professoresSnap.docs.map(d => [d.id, d.data().nome]));
      const turmasMap = new Map(turmasSnap.docs.map(d => [d.id, d.data()]));

      const anoInt = parseInt(ano);
      const notasQuery = query(
        collection(db, 'notas'),
        where('estudante_id', '==', estudanteId),
        where('ano', '==', anoInt)
      );
      let notasSnapshot = await getDocs(notasQuery);

      // Se não houver notas para este ano, apenas tenta atualizar documentos antigos sem ano
      if (notasSnapshot.empty) {
        console.warn('Nenhuma nota encontrada para ano', ano);
        // Busca apenas documentos sem campo ano para atualizar
        const todosNotasQuery = query(
          collection(db, 'notas'),
          where('estudante_id', '==', estudanteId)
        );
        const todasNotas = await getDocs(todosNotasQuery);
        // Atualiza documentos antigos que não possuem ano
        todasNotas.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.ano == null) {
            updateDoc(doc(db, 'notas', docSnap.id), { ano: anoInt }).catch(console.error);
          }
        });
        // Não retorna dados - o estudante realmente não tinha notas neste ano
      }

      // Busca a turma histórica do ano selecionado
      let turmaDoAno = { nome: '-', serie: '' };
      let compsTurma: any[] = [];
      const currentYear = String(new Date().getFullYear());
      let turmaIdResolved = null;

      if (notasSnapshot.docs.length > 0) {
        // Pega a primeira nota para obter o turma_id do ano
        turmaIdResolved = notasSnapshot.docs[0].data().turma_id;
      } else if (ano === currentYear && turmaId) {
        // Fallback: se não tiver nota mas for o ano atual usa a turma do estudante
        turmaIdResolved = turmaId;
      }

      const componenteProfIdMap = new Map<string, string>();

      if (turmaIdResolved && turmasMap.has(turmaIdResolved)) {
        const turmaData = turmasMap.get(turmaIdResolved);
        turmaDoAno = { nome: turmaData.nome, serie: turmaData.serie || '' };
        compsTurma = turmaData.componentes || [];
        compsTurma.forEach((c: any) => {
          if (c.nome && c.professorId) componenteProfIdMap.set(c.nome, c.professorId);
        });
      }

      setTurmaComponentes(compsTurma);
      setTurmaHistorica(turmaDoAno);

      // convert snapshot docs into map by componente name for easy lookup
      const notasMap = new Map<string, Nota>();
      notasSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Omit<Nota, 'id' | 'professor_nome'>;
        const resolvedProfId = data.professorId || componenteProfIdMap.get(data.componente);
        const profN = resolvedProfId ? (professoresMap.get(resolvedProfId) || 'Não encontrado') : 'N/A';
        const notaObj = { id: docSnap.id, ...data, professor_nome: profN } as Nota;
        notasMap.set(data.componente, notaObj);
      });

      const notasLista: Nota[] = [];
      const componentesVistos = new Set<string>();

      // 1. Injeta notas reais
      notasMap.forEach((nota, comp) => {
        notasLista.push(nota);
        componentesVistos.add(comp);
      });

      // 2. Injeta componentes da turma que ainda não possuem nota criada
      compsTurma.forEach(c => {
        if (c.nome && !componentesVistos.has(c.nome)) {
          const profN = c.professorId ? (professoresMap.get(c.professorId) || 'Não encontrado') : 'N/A';
          notasLista.push({
            id: `virtual_${c.nome}`,
            componente: c.nome,
            bimestre_1: null,
            bimestre_2: null,
            bimestre_3: null,
            bimestre_4: null,
            media_anual: null,
            situacao: 'Cursando',
            professorId: c.professorId,
            professor_nome: profN
          });
        }
      });

      // Ordenar alfabeticamente
      notasLista.sort((a, b) => a.componente.localeCompare(b.componente, 'pt-BR'));

      // show only notes that actually exist in the database for the selected year
      // if no notes for this year, display empty state

      console.log('Notas carregadas para', estudanteId, ano, notasLista);
      setNotas(notasLista);
    } catch (error) {
      toast.error('Sem permissão para carregar notas');
      console.error(error);
    }
  }

  async function loadFrequenciaData(estudanteId: string, ano: string) {
    try {
      const anoInt = parseInt(ano);
      const startDate = new Date(anoInt, 0, 1);
      const endDate = new Date(anoInt, 11, 31);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Carrega frequência do estudante para o ano selecionado
      let frequenciaSnap = await getDocs(query(
        collection(db, 'frequencias'),
        where('estudante_id', '==', estudanteId),
        where('ano', '==', anoInt)
      ));

      let mappedFrequencias = frequenciaSnap.docs.map(doc => doc.data());

      // Fallback para frequencia antigas sem ano no documento
      if (mappedFrequencias.length === 0) {
        const freqAntiga = await getDocs(query(
          collection(db, 'frequencias'),
          where('estudante_id', '==', estudanteId),
          where('data', '>=', startStr),
          where('data', '<=', endStr)
        ));
        mappedFrequencias = freqAntiga.docs.map(docSnap => {
          const data = docSnap.data();
          if (data.ano == null) {
            updateDoc(doc(db, 'frequencias', docSnap.id), { ano: anoInt }).catch(console.error);
          }
          return data;
        });
      }

      // Aggregate faltas anuais
      const faltas: Record<string, number[]> = {};

      mappedFrequencias.forEach(data => {
        if (data.status === 'faltou') {
          const parts = data.data.split('-');
          if (parts.length === 3) {
            const m = parseInt(parts[1], 10) - 1; // 0 for Jan, 11 for Dec
            const comp = data.componente || 'Outros';
            if (!faltas[comp]) {
              faltas[comp] = Array(12).fill(0);
            }
            faltas[comp][m] += 1;
          }
        }
      });

      // Busca a turma histórica do ano selecionado através das frequências
      let turmaDoAno = { nome: '-', serie: '' };
      if (frequenciaSnap.docs.length > 0 || mappedFrequencias.length > 0) {
        const turmasSnap = await getDocs(collection(db, 'turmas'));
        const turmasMap = new Map(turmasSnap.docs.map(d => [d.id, d.data()]));

        const primeiraFreq = frequenciaSnap.docs.length > 0 ? frequenciaSnap.docs[0].data() : mappedFrequencias[0];
        const turmaIdDoAno = primeiraFreq.turma_id;
        if (turmaIdDoAno && turmasMap.has(turmaIdDoAno)) {
          const turmaData = turmasMap.get(turmaIdDoAno);
          turmaDoAno = { nome: turmaData.nome, serie: turmaData.serie || '' };
          setTurmaComponentes(turmaData.componentes || []);
        }
      }

      if (turmaDoAno.nome !== '-') {
        setTurmaHistorica(turmaDoAno);
      }

      console.log('Faltas carregadas para', estudanteId, ano, faltas);
      setFaltasAnuais(faltas);
    } catch (error) {
      toast.error('Sem permissão para carregar frequência');
      console.error(error);
    }
  }

  const getNotaColor = (nota: number | null) => {
    if (nota === null || nota === undefined) return '';
    if (nota >= 8) return 'bg-green-100 text-green-900 font-semibold';
    if (nota >= 6) return 'bg-yellow-100 text-yellow-900 font-semibold';
    return 'bg-red-100 text-red-900 font-semibold';
  };

  // Calcula a média para exibição: usa media_anual do banco se existir,
  // caso contrário recalcula dos bimestres para suportar registros antigos.
  const calcularMediaDisplay = (nota: Nota): number | null => {
    if (nota.media_anual != null) return nota.media_anual;
    const { bimestre_1, bimestre_2, bimestre_3, bimestre_4 } = nota;
    if (bimestre_1 != null && bimestre_2 != null && bimestre_3 != null && bimestre_4 != null) {
      return Math.round(((bimestre_1 + bimestre_2 + bimestre_3 + bimestre_4) / 4) * 10) / 10;
    }
    return null;
  };

  const getSituacaoDisplay = (nota: Nota): string => {
    if (nota.situacao && nota.situacao !== 'Cursando') return nota.situacao;
    const media = calcularMediaDisplay(nota);
    if (media === null) return 'Cursando';
    return media >= 6 ? 'Aprovado' : 'Reprovado';
  };

  if (loading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      </AppLayout>
    );
  }

  if (!estudante) {
    return (
      <AppLayout title="Estudante não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">O perfil do estudante não pôde ser carregado.</p>
          <Button className="mt-4" onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/painel')}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const handleGenerateDoc = (type: 'declaracaoMatricula' | 'termoCompromisso' | 'autorizacaoSaida' | 'declaracaoComparecimento' | 'termoUsoImagem' | 'termoAutorizacaoTrajeto', title: string) => {
    setPrintDocType(type);
    setPrintDocTitle(title);
    setPrintDocOpen(true);
  };

  return (
    <AppLayout>
      <div className="w-full max-w-full space-y-4 pt-4 md:pt-0 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6 min-w-0">
          <div className="min-w-0 uppercase">
            <h2 className="text-xl md:text-3xl font-bold tracking-tight break-words">Detalhes do Estudante</h2>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Visualize informações detalhadas, notas e frequência do aluno</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('declaracaoMatricula', 'Declaração de Matrícula')}>
              <Download className="h-4 w-4 mr-2" />
              Declaração
            </Button>
            {role !== 'estudante' && (
              <>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('termoCompromisso', 'Termo de Compromisso')}>
                  <Download className="h-4 w-4 mr-2" />
                  Compromisso
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('autorizacaoSaida', 'Autorização de Saída')}>
                  <Download className="h-4 w-4 mr-2" />
                  Saída
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('declaracaoComparecimento', 'Declaração de Comparecimento')}>
                  <Download className="h-4 w-4 mr-2" />
                  Comparecimento
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('termoUsoImagem', 'Termo de Uso de Imagem')}>
                  <Download className="h-4 w-4 mr-2" />
                  Uso Imagem
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" onClick={() => handleGenerateDoc('termoAutorizacaoTrajeto', 'Termo de Trajeto')}>
                  <Download className="h-4 w-4 mr-2" />
                  Trajeto
                </Button>
              </>
            )}
          </div>
        </div>

        {role !== 'estudante' && (
          <div>
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Lista de Estudantes
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12 mt-6 w-full max-w-full overflow-hidden">
          {/* Coluna de Informações Pessoais */}
          <div className="lg:col-span-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* Avatar e Informações Básicas */}
                  <div className="flex flex-col items-center text-center border-b pb-6">
                    <Avatar className="h-24 w-24 md:h-32 md:w-32 mb-4 border-4 border-muted">
                      <AvatarImage src={estudante.foto_url || undefined} />
                      <AvatarFallback className="text-3xl md:text-4xl bg-blue-50 text-blue-600 font-semibold">
                        {estudante.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl md:text-2xl font-bold break-words w-full">{estudante.nome}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Matrícula: {estudante.matricula}</p>
                    <div className="flex items-center gap-2 mt-4 justify-center flex-wrap">
                      {estudante.turma_id && estudante.turma_nome && estudante.turma_nome !== '-' ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-semibold text-xs px-3 py-1">
                          {estudante.turma_nome}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 font-semibold text-xs px-3 py-1">
                          Sem turma
                        </Badge>
                      )}
                      <Badge variant="default" className={`font-semibold text-xs px-3 py-1 ${estudante.status === 'Frequentando' ? 'bg-green-100 text-green-800' :
                        estudante.status === 'Desistente' || estudante.status === 'Transferido' ? 'bg-muted text-muted-foreground' :
                          estudante.status === 'Concluído' ? 'bg-blue-100 text-blue-800' :
                            'bg-warning/10 text-warning'
                        }`}>
                        {estudante.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Informações Pessoais */}
                  <div className="space-y-5 border-b pb-6">
                    <h4 className="font-semibold text-sm">Informações Pessoais</h4>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Data de Nascimento</p>
                        <p className="font-medium text-sm">
                          {(() => {
                            const date = safeParseDate(estudante.data_nascimento);
                            return date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : 'Não informado';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Endereço</p>
                        <p className="font-medium text-sm break-words whitespace-pre-wrap">{[estudante.endereco, estudante.bairro, estudante.cidade, estudante.estado].filter(Boolean).join(', ') || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Contato</p>
                        <p className="font-medium text-sm">{estudante.contato || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">E-mail</p>
                        <p className="font-medium text-sm break-all">{estudante.email || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>
                  {estudante.responsavel_relacao && (
                    <div className="space-y-5 border-b pb-6">
                      <h4 className="font-semibold text-sm">Informações do Responsável</h4>
                      <p className="text-sm">{estudante.responsavel_relacao}</p>
                      <div className="flex items-start gap-3">
                        <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="font-medium text-sm">{estudante.responsavel_nome || '-'}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Contact className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="font-medium text-sm">{estudante.responsavel_contato || '-'}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="font-medium text-sm break-all">{estudante.responsavel_email || '-'}</p>
                      </div>
                    </div>
                  )}

                  {/* Informações Adicionais */}
                  <div className="space-y-5">
                    <h4 className="font-semibold text-sm">Informações Adicionais</h4>
                    <div className="flex items-start gap-3">
                      <Activity className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Tamanho da Farda</p>
                        <p className="font-medium text-sm">{estudante.farda_tamanho || '-'}</p>

                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Pasta</p>
                        <p className="font-medium text-sm">{estudante.pasta || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Prateleira</p>
                        <p className="font-medium text-sm">{estudante.prateleira || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Saúde e Acessibilidade */}
                  {(estudante.estudante_pcd || estudante.estudante_aee) && (
                    <div className="space-y-5">
                      <h4 className="font-semibold text-sm">Saúde e Acessibilidade</h4>
                      {estudante.estudante_pcd && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">PCD - Deficiências</p>
                          <div className="flex flex-wrap gap-1">
                            {estudante.deficiencias && estudante.deficiencias.length > 0 ? (
                              estudante.deficiencias.map(def => (
                                <Badge key={def} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                  {def}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">PCD</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {estudante.estudante_aee && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">AEE - Atendimento Especializado</p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">AEE</Badge>
                            {estudante.cid_aee && (
                              <span className="text-xs font-bold text-muted-foreground">CID: {estudante.cid_aee}</span>
                            )}
                          </div>
                          {estudante.laudo_aee_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-1 text-xs h-8 border-dashed"
                              onClick={() => window.open(estudante.laudo_aee_url, '_blank')}
                            >
                              <FileText className="h-3.5 w-3.5 mr-2 text-primary" />
                              Ver Laudo PDF
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna de Desempenho Acadêmico */}
          <div className="lg:col-span-8 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <Card>
                <div className="border-b">
                  <CardHeader className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <CardTitle className="text-lg">Desempenho Acadêmico</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Ano:</span>
                          <Select value={selectedYear} onValueChange={(val) => {
                            setSelectedYear(val);
                          }}>
                            <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from(new Set([
                                String(estudante?.ano || new Date().getFullYear()),
                                ...(estudante?.historico_academico?.map(h => h.ano_letivo) || [])
                              ].filter(Boolean))).sort((a, b) => b.localeCompare(a)).map(year => (
                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <TabsList className="bg-muted">
                            <TabsTrigger value="notas" className="text-xs">Notas</TabsTrigger>
                            <TabsTrigger value="frequencia" className="text-xs">Frequência</TabsTrigger>
                          </TabsList>
                          <div className="hidden lg:flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300" />≥ 8</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300" />6‑7.9</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />{'<6'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </div>

                <TabsContent value="notas" className="m-0 border-t-0">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Boletim</h4>
                        <p className="text-xs text-muted-foreground">Notas por Componente</p>
                      </div>
                      <div className="overflow-x-auto scrollbar-custom -mx-6 sm:mx-0 sm:border sm:rounded-lg">
                        <div className="min-w-[800px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                                <TableHead className="font-semibold text-xs h-10">Componente</TableHead>
                                <TableHead className="font-semibold text-xs h-10">Professor</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">1º Bim</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">2º Bim</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">3º Bim</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">4º Bim</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">Média</TableHead>
                                <TableHead className="text-center font-semibold text-xs h-10">Situação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {notas.length > 0 ? notas.map((nota) => {
                                const mediaDisplay = calcularMediaDisplay(nota);
                                const situacaoDisplay = getSituacaoDisplay(nota);
                                return (
                                  <TableRow key={nota.id} className="border-b hover:bg-muted/30">
                                    <TableCell className="font-medium text-sm py-3">{nota.componente}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm py-3">{nota.professor_nome}</TableCell>
                                    <TableCell className={`text-center font-semibold text-sm py-3 ${getNotaColor(nota.bimestre_1)}`}>{formatNota(nota.bimestre_1) || '-'}</TableCell>
                                    <TableCell className={`text-center font-semibold text-sm py-3 ${getNotaColor(nota.bimestre_2)}`}>{formatNota(nota.bimestre_2) || '-'}</TableCell>
                                    <TableCell className={`text-center font-semibold text-sm py-3 ${getNotaColor(nota.bimestre_3)}`}>{formatNota(nota.bimestre_3) || '-'}</TableCell>
                                    <TableCell className={`text-center font-semibold text-sm py-3 ${getNotaColor(nota.bimestre_4)}`}>{formatNota(nota.bimestre_4) || '-'}</TableCell>
                                    <TableCell className={`text-center font-semibold text-sm py-3 ${getNotaColor(mediaDisplay)}`}>{formatNota(mediaDisplay) || '-'}</TableCell>
                                    <TableCell className="text-center text-sm py-3">
                                      <Badge variant="default" className={`font-semibold text-xs capitalize ${situacaoDisplay === 'Aprovado' ? 'bg-green-100 text-green-800' :
                                        situacaoDisplay === 'Reprovado' ? 'bg-red-100 text-red-800' :
                                          'bg-blue-100 text-blue-800'
                                        }`}>
                                        {situacaoDisplay}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              }) : (
                                <TableRow>
                                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Nenhuma nota registrada para este ano.</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
                        {role !== 'estudante' && (
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto" onClick={() => setTransferenciaDialogOpen(true)}>
                            <FileDown className="h-4 w-4 mr-2" />Transferência
                          </Button>
                        )}
                        <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white w-full sm:w-auto" onClick={() => setBoletimDialogOpen(true)}>
                          <Download className="h-4 w-4 mr-2" />Boletim
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="frequencia" className="m-0 border-t-0">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Frequência Escolar</h4>
                        <p className="text-xs text-muted-foreground">Total de faltas por componente no ano de {selectedYear}</p>
                      </div>
                      <div className="overflow-x-auto scrollbar-custom -mx-6 sm:mx-0 sm:border sm:rounded-lg">
                        <div className="min-w-[800px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                                <TableHead className="font-semibold text-xs h-10 min-w-[150px]">Componente Curricular</TableHead>
                                {['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].map((mes) => (
                                  <TableHead key={mes} className="text-center font-semibold text-xs h-10 w-[40px] px-1 capitalize">{mes}</TableHead>
                                ))}
                                <TableHead className="text-center font-semibold text-xs h-10 w-[60px]">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(turmaComponentes.length > 0 || Object.keys(faltasAnuais).length > 0) ? (
                                Array.from(new Set([...(turmaComponentes.map(c => c.nome)), ...Object.keys(faltasAnuais)])).sort().map((comp) => {
                                  const faltas = faltasAnuais[comp] || Array(12).fill(0);
                                  const totalFaltas = faltas.reduce((a, b) => a + b, 0);
                                  return (
                                    <TableRow key={comp} className="border-b hover:bg-muted/30">
                                      <TableCell className="font-medium text-sm py-3">{comp}</TableCell>
                                      {faltas.map((f, i) => (
                                        <TableCell key={i} className={`text-center text-sm py-3 ${f > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>{f > 0 ? f : '-'}</TableCell>
                                      ))}
                                      <TableCell className="text-center font-bold text-sm py-3 text-red-700">{totalFaltas > 0 ? totalFaltas : '-'}</TableCell>
                                    </TableRow>
                                  );
                                })
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">Nenhuma falta registrada ou componentes não definidos.</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </TabsContent>
              </Card>
            </Tabs>

            {/* Histórico Escolar Card */}
            {estudante?.historico_academico && estudante.historico_academico.length > 0 && (
              <div className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Histórico Escolar
                    </CardTitle>
                    <CardDescription>
                      Registros acadêmicos pregressos inseridos manualmente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full space-y-4">
                      {estudante.historico_academico.map((anoHistorico) => {
                        // Para o ano selecionado, usa as notas reais do boletim (já carregadas)
                        const isAnoAtual = anoHistorico.ano_letivo === selectedYear;
                        const notasMap = isAnoAtual
                          ? new Map(notas.map(n => [n.componente, n]))
                          : new Map();

                        return (
                          <AccordionItem
                            key={anoHistorico.id}
                            value={anoHistorico.id}
                            className="border rounded-lg px-4 bg-muted/20 data-[state=open]:bg-muted/40 transition-colors"
                          >
                            <AccordionTrigger className="hover:no-underline py-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-left w-full pr-4">
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
                                  <span className="font-semibold">{anoHistorico.ano_letivo}</span>
                                </div>
                                <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1.5 line-clamp-1">
                                    <GraduationCap className="h-4 w-4 shrink-0" />
                                    {anoHistorico.serie || 'Classificação não informada'}
                                  </span>
                                  {anoHistorico.escola && (
                                    <span className="flex items-center gap-1.5 line-clamp-1">
                                      <Home className="h-4 w-4 shrink-0" />
                                      {anoHistorico.escola}
                                    </span>
                                  )}
                                  {isAnoAtual && (
                                    <span className="text-xs text-blue-500 font-medium">● notas do boletim</span>
                                  )}
                                </div>
                                <Badge variant={anoHistorico.concluido ? 'default' : 'secondary'} className={anoHistorico.concluido ? 'bg-success/10 text-success hover:bg-success/20' : ''}>
                                  {anoHistorico.concluido ? 'Concluído' : 'Em andamento'}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                              <div className="overflow-x-auto border rounded-md bg-background">
                                <div className="min-w-[600px]">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold text-xs h-10">Componente Curricular</TableHead>
                                        <TableHead className="text-center font-semibold text-xs h-10 w-16 px-1">1º Bim</TableHead>
                                        <TableHead className="text-center font-semibold text-xs h-10 w-16 px-1">2º Bim</TableHead>
                                        <TableHead className="text-center font-semibold text-xs h-10 w-16 px-1">3º Bim</TableHead>
                                        <TableHead className="text-center font-semibold text-xs h-10 w-16 px-1">4º Bim</TableHead>
                                        <TableHead className="text-center font-semibold text-xs h-10 w-20 px-1">Média Final</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(() => {
                                        let displayComponentes = anoHistorico.componentes || [];
                                        if (isAnoAtual) {
                                          const compMap = new Map<string, HistoricoDisciplina>();
                                          displayComponentes.forEach(c => {
                                            if (c.nome) compMap.set(c.nome, c);
                                          });
                                          notasMap.forEach((nota, nome) => {
                                            if (!compMap.has(nome)) {
                                              compMap.set(nome, { id: nota.id, nome, nota_b1: '', nota_b2: '', nota_b3: '', nota_b4: '', media_final: '' });
                                            }
                                          });
                                          turmaComponentes.forEach(tc => {
                                            if (tc.nome && !compMap.has(tc.nome)) {
                                              compMap.set(tc.nome, { id: `tc_${tc.nome}`, nome: tc.nome, nota_b1: '', nota_b2: '', nota_b3: '', nota_b4: '', media_final: '' });
                                            }
                                          });
                                          displayComponentes = Array.from(compMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
                                        }

                                        if (displayComponentes.length === 0) {
                                          return (
                                            <TableRow>
                                              <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                                                Nenhum componente registrado.
                                              </TableCell>
                                            </TableRow>
                                          );
                                        }

                                        return displayComponentes.map((disciplina) => {
                                          if (!disciplina.nome) return null;

                                          // Para o ano atual, usa notas reais do boletim se disponíveis
                                          const notaReal = notasMap.get(disciplina.nome);
                                          const b1 = notaReal ? formatNota(notaReal.bimestre_1) : (disciplina.nota_b1 || '-');
                                          const b2 = notaReal ? formatNota(notaReal.bimestre_2) : (disciplina.nota_b2 || '-');
                                          const b3 = notaReal ? formatNota(notaReal.bimestre_3) : (disciplina.nota_b3 || '-');
                                          const b4 = notaReal ? formatNota(notaReal.bimestre_4) : (disciplina.nota_b4 || '-');
                                          const mediaNum = notaReal ? calcularMediaDisplay(notaReal) : null;
                                          const mediaStr = mediaNum != null
                                            ? formatNota(mediaNum)
                                            : (disciplina.media_final || '-');
                                          const mediaColorClass = mediaNum != null ? getNotaColor(mediaNum) : '';

                                          return (
                                            <TableRow key={disciplina.id} className="border-b last:border-0 hover:bg-muted/10">
                                              <TableCell className="font-medium text-sm py-2">
                                                {disciplina.nome}
                                              </TableCell>
                                              <TableCell className={`text-center text-sm py-2 px-1 ${notaReal ? getNotaColor(notaReal.bimestre_1) : 'text-muted-foreground'}`}>
                                                {b1 || '-'}
                                              </TableCell>
                                              <TableCell className={`text-center text-sm py-2 px-1 ${notaReal ? getNotaColor(notaReal.bimestre_2) : 'text-muted-foreground'}`}>
                                                {b2 || '-'}
                                              </TableCell>
                                              <TableCell className={`text-center text-sm py-2 px-1 ${notaReal ? getNotaColor(notaReal.bimestre_3) : 'text-muted-foreground'}`}>
                                                {b3 || '-'}
                                              </TableCell>
                                              <TableCell className={`text-center text-sm py-2 px-1 ${notaReal ? getNotaColor(notaReal.bimestre_4) : 'text-muted-foreground'}`}>
                                                {b4 || '-'}
                                              </TableCell>
                                              <TableCell className={`text-center font-semibold text-sm py-2 px-1 ${mediaColorClass}`}>
                                                {mediaStr}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        });
                                      })()}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </div>

      {estudante && (
        <TransferenciaDialog
          open={transferenciaDialogOpen}
          onOpenChange={setTransferenciaDialogOpen}
          estudante={estudante}
        />
      )}

      {estudante && (
        <BoletimDialog
          open={boletimDialogOpen}
          onOpenChange={setBoletimDialogOpen}
          estudanteNome={estudante.nome}
          estudanteMatricula={estudante.matricula}
          estudanteNascimento={estudante.data_nascimento || undefined}
          turmaNome={turmaHistorica.nome}
          turmaSerie={turmaHistorica.serie}
          ano={selectedYear}
          notas={notas}
          faltasAnuais={faltasAnuais}
        />
      )}

      {estudante && (
        <DocumentPrintDialog
          open={printDocOpen}
          onOpenChange={setPrintDocOpen}
          title={printDocTitle}
          type={printDocType}
          estudanteNome={estudante.nome}
          estudanteMatricula={estudante.matricula}
          estudanteNascimento={estudante.data_nascimento || undefined}
          rg={estudante.rg || undefined}
          cpf={estudante.cpf || undefined}
          responsavelNome={estudante.responsavel_nome || estudante.mae_nome || estudante.pai_nome || undefined}
          responsavelRg={estudante.responsavel_rg || undefined}
          endereco={estudante.endereco || undefined}
          bairro={estudante.bairro || undefined}
          cidade={estudante.cidade || undefined}
          estado={estudante.estado || undefined}
          turmaNome={turmaHistorica.nome}
          turmaSerie={turmaHistorica.serie}
          turmaTurno={estudante.turma_turno || ''}
          ano={selectedYear}
          notas={notas}
        />
      )}
    </AppLayout>
  );
}
