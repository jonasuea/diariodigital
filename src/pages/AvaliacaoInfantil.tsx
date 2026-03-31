import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, User, ChevronRight, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { logActivity } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Estrutura dos Campos de Experiência ─────────────────────────────────────
interface OpcaoAvaliacao {
  value: string;
  label: string;
}

interface Criterio {
  key: string;
  label: string;
  opcoes: OpcaoAvaliacao[];
}

interface CampoExperiencia {
  numero: number;
  titulo: string;
  foco: string;
  cor: string;
  criterios: Criterio[];
}

const CAMPOS_EXPERIENCIA: CampoExperiencia[] = [
  {
    numero: 1,
    titulo: 'O Eu, o Outro e o Nós',
    foco: 'Foco: Identidade e Convivência',
    cor: 'bg-blue-600',
    criterios: [
      {
        key: 'interacao_social',
        label: 'Interação Social',
        opcoes: [
          { value: 'C',  label: 'Interage com os pares de forma cooperativa, partilhando brinquedos e espaços.' },
          { value: 'ED', label: 'Participa de brincadeiras em grupo, mas às vezes necessita de mediação para partilhar.' },
          { value: 'I',  label: 'Demonstra preferência por brincar sozinho em fase de adaptação ao convívio coletivo.' },
        ],
      },
      {
        key: 'autonomia',
        label: 'Autonomia',
        opcoes: [
          { value: 'C',  label: 'Realiza tarefas de autocuidado e organiza seus pertences com independência.' },
          { value: 'ED', label: 'Tenta realizar atividades sozinho, mas solicita ajuda do professor em desafios simples.' },
          { value: 'I',  label: 'Depende totalmente da mediação do adulto para realizar tarefas básicas do cotidiano.' },
        ],
      },
      {
        key: 'regras_sentimentos',
        label: 'Regras e Sentimentos',
        opcoes: [
          { value: 'C',  label: 'Respeita os combinados da turma e expressa o que sente de forma clara e calma.' },
          { value: 'ED', label: 'Compreende as regras, mas precisa de lembretes constantes para seguí-las.' },
          { value: 'I',  label: 'Apresenta dificuldade em aceitar limites e em nomear suas emoções e frustrações.' },
        ],
      },
    ],
  },
  {
    numero: 2,
    titulo: 'Traços, Sons, Cores e Formas',
    foco: 'Foco: Sensibilidade Artística e Cultural',
    cor: 'bg-purple-600',
    criterios: [
      {
        key: 'exploracao_materiais',
        label: 'Exploração de Materiais',
        opcoes: [
          { value: 'C',  label: 'Utiliza diversos materiais (tintas, argila, papéis) de forma criativa e intencional em suas produções.' },
          { value: 'ED', label: 'Explora os materiais disponíveis, mas ainda demonstra preferência por apenas um tipo de técnica ou suporte.' },
          { value: 'I',  label: 'Demonstra resistência ou pouco interesse em manusear materiais diferentes (como tintas ou texturas).' },
        ],
      },
      {
        key: 'sons_musica',
        label: 'Sons e Música',
        opcoes: [
          { value: 'C',  label: 'Identifica ritmos e sons variados, participando ativamente de brincadeiras cantadas e criações sonoras.' },
          { value: 'ED', label: 'Acompanha músicas e ritmos simples, mas necessita de incentivo para explorar sons com objetos ou instrumentos.' },
          { value: 'I',  label: 'Apresenta dificuldade em perceber variações sonoras ou em acompanhar o ritmo das atividades coletivas.' },
        ],
      },
      {
        key: 'criatividade_visual',
        label: 'Criatividade Visual',
        opcoes: [
          { value: 'C',  label: 'Cria desenhos, pinturas e colagens autorais, demonstrando cuidado e detalhes em suas produções.' },
          { value: 'ED', label: 'Realiza produções visuais simples, muitas vezes reproduzindo modelos prontos ou com poucos detalhes.' },
          { value: 'I',  label: 'Está iniciando o contato com a expressão visual; as produções ainda são muito básicas ou sem intenção figurativa.' },
        ],
      },
    ],
  },
  {
    numero: 3,
    titulo: 'Corpo, Gestos e Movimentos',
    foco: 'Foco: Linguagem Corporal e Expressão',
    cor: 'bg-teal-600',
    criterios: [
      {
        key: 'coordenacao',
        label: 'Coordenação',
        opcoes: [
          { value: 'C',  label: 'Demonstra excelente controle motor fino ao usar tesoura, pincel e massinha.' },
          { value: 'ED', label: 'Está aprimorando o uso da tesoura e o traço, demonstrando progressos graduais.' },
          { value: 'I',  label: 'Apresenta dificuldades em habilidades manuais que exigem precisão e força.' },
        ],
      },
      {
        key: 'espaco_corpo',
        label: 'Espaço/Corpo',
        opcoes: [
          { value: 'C',  label: 'Movimenta-se com segurança, respeitando os limites espaciais e o corpo do outro.' },
          { value: 'ED', label: 'Participa de atividades físicas, mas ainda se choca com objetos ou colegas às vezes.' },
          { value: 'I',  label: 'Demonstra insegurança em atividades de deslocamento e pouco domínio espacial.' },
        ],
      },
    ],
  },
  {
    numero: 4,
    titulo: 'Escuta, Fala, Pensamento e Imaginação',
    foco: 'Foco: Comunicação e Letramento',
    cor: 'bg-orange-500',
    criterios: [
      {
        key: 'linguagem_oral',
        label: 'Linguagem Oral',
        opcoes: [
          { value: 'C',  label: 'Relata fatos e experiências com clareza, usando vocabulário rico e coerente.' },
          { value: 'ED', label: 'Comunica suas necessidades de forma simples, mas precisa de incentivo para narrar histórias.' },
          { value: 'I',  label: 'Utiliza frases curtas ou gestos para se comunicar; em fase de expansão do vocabulário.' },
        ],
      },
      {
        key: 'escrita_espontanea',
        label: 'Escrita Espontânea',
        opcoes: [
          { value: 'C',  label: 'Identifica seu nome e tenta escrever palavras familiares de forma espontânea.' },
          { value: 'ED', label: 'Demonstra interesse pelas letras e faz tentativas de escrita usando pseudoletras.' },
          { value: 'I',  label: 'Ainda não demonstra interesse pela escrita ou pelo reconhecimento das letras.' },
        ],
      },
    ],
  },
  {
    numero: 5,
    titulo: 'Espaços, Tempos, Quantidades',
    foco: 'Foco: Pensamento Lógico e Curiosidade Científica',
    cor: 'bg-green-700',
    criterios: [
      {
        key: 'numeros_quantidades',
        label: 'Números/Quant.',
        opcoes: [
          { value: 'C',  label: 'Conta objetos com correspondência e identifica números em diferentes contextos.' },
          { value: 'ED', label: 'Realiza contagem oral, mas ainda apresenta dificuldade em relacionar ao numeral.' },
          { value: 'I',  label: 'Está iniciando o processo de reconhecimento de números e contagem básica.' },
        ],
      },
      {
        key: 'nocoes_espaciais',
        label: 'Noções Espaciais',
        opcoes: [
          { value: 'C',  label: 'Compreende e utiliza conceitos como “em cima”, “atrás”, “dentro” e “fora”.' },
          { value: 'ED', label: 'Identifica alguns conceitos espaciais, mas se confunde em situações mais complexas.' },
          { value: 'I',  label: 'Necessita de apoio concreto e mediação para compreender orientações espaciais.' },
        ],
      },
    ],
  },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Estudante {
  id: string;
  nome: string;
  matricula?: string;
  foto_url?: string;
}

type CriterioMap = Record<string, string>;
type ObsMap = Record<string, string>;

type AvaliacaoData = {
  criterios: CriterioMap;
  observacoes: ObsMap;
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function AvaliacaoInfantil() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user } = useAuth();

  const [turmaNome, setTurmaNome] = useState('');
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [avaliadosIds, setAvaliadosIds] = useState<Set<string>>(new Set());
  const [selectedEstudante, setSelectedEstudante] = useState<Estudante | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const selectedDate = searchParams.get('data');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoData>({ criterios: {}, observacoes: {} });

  // Carrega turma e estudantes
  useEffect(() => {
    if (!turmaId) return;
    if (!selectedDate) {
      navigate(`/diario-digital/avaliacao-infantil/${turmaId}/calendario`);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const turmaDoc = await getDoc(doc(db, 'turmas', turmaId));
        if (turmaDoc.exists()) setTurmaNome(turmaDoc.data().nome || '');

        const q = query(
          collection(db, 'estudantes'),
          where('turma_id', '==', turmaId),
          where('excluido', '==', false),
          orderBy('nome')
        );
        const snap = await getDocs(q);
        const estudantesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Estudante));
        setEstudantes(estudantesData);

        // Busca quais estudantes já têm avaliação salva para ESTA DATA
        const avalIds = new Set<string>();
        await Promise.all(
          estudantesData.map(async est => {
            // Tenta data específica primeiro
            const docIdDate = `${turmaId}_${est.id}_${selectedDate}`;
            const avalSnapDate = await getDoc(doc(db, 'avaliacoes_infantil', docIdDate));
            if (avalSnapDate.exists()) {
              avalIds.add(est.id);
            } else {
              // Fallback para o ano (legado)
              const anoAtual = new Date().getFullYear();
              const docIdYear = `${turmaId}_${est.id}_${anoAtual}`;
              const avalSnapYear = await getDoc(doc(db, 'avaliacoes_infantil', docIdYear));
              if (avalSnapYear.exists()) avalIds.add(est.id);
            }
          })
        );
        setAvaliadosIds(avalIds);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar estudantes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [turmaId]);

  // Carrega avaliação existente ao selecionar estudante
  async function handleSelectEstudante(est: Estudante) {
    setSelectedEstudante(est);
    setAvaliacao({ criterios: {}, observacoes: {} });
    if (!turmaId || !selectedDate) return;
    try {
      // Tenta carregar da data específica
      const docIdDate = `${turmaId}_${est.id}_${selectedDate}`;
      let snap = await getDoc(doc(db, 'avaliacoes_infantil', docIdDate));
      
      // Fallback para ano (legado) se não encontrar na data
      if (!snap.exists()) {
        const anoAtual = new Date().getFullYear();
        const docIdYear = `${turmaId}_${est.id}_${anoAtual}`;
        snap = await getDoc(doc(db, 'avaliacoes_infantil', docIdYear));
      }

      if (snap.exists()) {
        const data = snap.data();
        setAvaliacao({
          criterios: data.criterios || {},
          observacoes: data.observacoes || {},
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  function setCriterio(key: string, value: string) {
    setAvaliacao(prev => ({ ...prev, criterios: { ...prev.criterios, [key]: value } }));
  }

  function setObservacao(campoNum: number, value: string) {
    setAvaliacao(prev => ({ ...prev, observacoes: { ...prev.observacoes, [`campo_${campoNum}`]: value } }));
  }

  async function handleSave() {
    if (!selectedEstudante || !turmaId || !user) return;
    setSaving(true);
    try {
      const docId = `${turmaId}_${selectedEstudante.id}_${selectedDate}`;
      const dataParsed = selectedDate ? parseISO(selectedDate) : new Date();
      const ano = isValid(dataParsed) ? dataParsed.getFullYear() : new Date().getFullYear();

      await setDoc(doc(db, 'avaliacoes_infantil', docId), {
        turma_id: turmaId,
        estudante_id: selectedEstudante.id,
        estudante_nome: selectedEstudante.nome,
        ano: ano,
        data_avaliacao: selectedDate,
        criterios: avaliacao.criterios,
        observacoes: avaliacao.observacoes,
        atualizado_por: user.email,
        atualizado_em: serverTimestamp(),
      }, { merge: true });
      toast.success('Avaliação salva com sucesso!');
      await logActivity(`salvou a avaliação infantil de "${selectedEstudante.nome}" na turma "${turmaNome}" para o dia ${selectedDate}.`);
      setAvaliadosIds(prev => new Set(prev).add(selectedEstudante.id));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar avaliação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Cabeçalho */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Avaliações</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Registro de avaliação contínua da Educação Infantil
              {turmaNome ? ` — Turma ${turmaNome}` : ''}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/diario-digital')} className="shrink-0 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Corpo: lista + formulário */}
        <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-160px)] min-h-[500px]">

          {/* ── Lista de estudantes ────────────────────────────── */}
          <Card className={cn(
            "w-full md:w-[400px] flex-shrink-0 overflow-hidden flex-col",
            selectedEstudante ? "hidden md:flex" : "flex"
          )}>
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Estudantes ({estudantes.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : estudantes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum estudante nesta turma.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {estudantes.map((est, idx) => (
                    <li key={est.id}>
                      <button
                        onClick={() => handleSelectEstudante(est)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60',
                          selectedEstudante?.id === est.id && 'bg-primary/10 text-primary font-semibold',
                          avaliadosIds.has(est.id) && selectedEstudante?.id !== est.id && 'bg-green-50 dark:bg-green-950/30'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                            selectedEstudante?.id === est.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {idx + 1}
                          </div>
                          <span className="truncate">{est.nome}</span>
                        </div>
                        <ChevronRight className={cn(
                          'h-4 w-4 flex-shrink-0 transition-transform',
                          selectedEstudante?.id === est.id ? 'text-primary' : 'text-muted-foreground/40'
                        )} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* ── Formulário de avaliação ────────────────────────── */}
          <div className={cn(
            "flex-1 overflow-y-auto w-full",
            !selectedEstudante ? "hidden md:block" : "block"
          )}>
            {!selectedEstudante ? (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full text-center py-16">
                  <User className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-medium">Selecione um estudante</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Clique em um nome na lista para abrir o formulário de avaliação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Botão de voltar para a lista (mobile only) */}
                <div className="md:hidden flex items-center px-1 pb-2 border-b mb-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEstudante(null)} className="-ml-3 gap-2 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar à lista de estudantes
                  </Button>
                </div>

                {/* Nome do estudante + botão salvar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                  <div>
                    <h2 className="text-lg font-bold">{selectedEstudante.nome}</h2>
                    {selectedEstudante.matricula && (
                      <p className="text-xs text-muted-foreground">Matrícula: {selectedEstudante.matricula}</p>
                    )}
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Salvando...' : 'Salvar Avaliação'}
                  </Button>
                </div>

                {/* Campos de Experiência */}
                {CAMPOS_EXPERIENCIA.map(campo => (
                  <Card key={campo.numero} className="overflow-hidden border-border/60 shadow-sm">
                    {/* Header colorido */}
                    <div className={cn('flex items-start gap-4 px-5 py-4', campo.cor)}>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">{campo.numero}</span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm md:text-base leading-tight">{campo.titulo}</p>
                        <p className="text-white/80 text-xs mt-0.5">{campo.foco}</p>
                      </div>
                    </div>

                    {/* Critérios */}
                    <CardContent className="p-0">
                      {campo.criterios.map((crit, idx) => (
                        <div
                          key={crit.key}
                          className={cn(
                            'flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 px-5 py-4',
                            idx < campo.criterios.length - 1 && 'border-b'
                          )}
                        >
                          <label className="text-sm font-medium text-foreground lg:min-w-[170px] xl:min-w-[200px]">
                            {crit.label}
                          </label>
                          <Select
                            value={avaliacao.criterios[crit.key] || ''}
                            onValueChange={val => setCriterio(crit.key, val)}
                          >
                            <SelectTrigger className="w-full lg:flex-1 lg:max-w-md bg-white dark:bg-zinc-950 text-left h-auto py-2">
                              <SelectValue placeholder="— Selecione uma avaliação —" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md md:max-w-lg lg:max-w-xl">
                              {crit.opcoes.map(op => (
                                <SelectItem key={op.value} value={op.value} className="whitespace-normal py-3 text-sm border-b last:border-0 hover:bg-muted/50">
                                  <span className="font-bold">{op.value}</span> — {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}

                      {/* Observações */}
                      <div className="px-5 py-4 border-t bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                          Observações do Campo {campo.numero}
                        </p>
                        <Textarea
                          rows={3}
                          placeholder={`Registre observações complementares sobre ${campo.foco.replace('Foco: ', '').toLowerCase()}...`}
                          value={avaliacao.observacoes[`campo_${campo.numero}`] || ''}
                          onChange={e => setObservacao(campo.numero, e.target.value)}
                          className="resize-none text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Botão salvar (rodapé) */}
                <div className="flex justify-end pb-4">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Salvando...' : 'Salvar Avaliação'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
