import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, BookOpen, ClipboardList, GraduationCap, Filter } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSyncData } from '@/hooks/useSyncData';
import { OfflineIndicator } from '@/components/OfflineIndicator';

interface ComponenteCurricular {
  nome: string;
  professorId: string;
}

interface Professor {
  id: string;
  nome: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  componentes: ComponenteCurricular[];
  professoresIds: string[];
}

export default function DiarioDigital() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, escolaAtivaId, loading: roleLoading, professorId: contextProfessorId } = useUserRole();

  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [componentes, setComponentes] = useState<ComponenteCurricular[]>([]);

  // Hook de Sincronização Proativa
  const { isSyncing, progress, lastSync, startSync } = useSyncData(escolaAtivaId, contextProfessorId, turmas);

  const STORAGE_KEY = 'diario_filtros';

  const getStoredFilters = () => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const storedFilters = getStoredFilters();

  const [selectedProfessorId, setSelectedProfessorId] = useState(storedFilters.professorId || '');
  const [selectedTurmaId, setSelectedTurmaId] = useState(storedFilters.turmaId || '');
  const [selectedComponente, setSelectedComponente] = useState(storedFilters.componente || '');
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(!!storedFilters.turmaId);

  const isGestor = role && role !== 'professor';

  // O ID do professor agora vem diretamente do useUserRole (contextProfessorId)
  // que já gerencia cache e persistência offline.

  // Efeito para carregar professores (apenas para gestores)
  useEffect(() => {
    if (isGestor && escolaAtivaId) {
      async function fetchProfessores() {
        try {
          const profQuery = query(collection(db, 'professores'), where('escola_ids', 'array-contains', escolaAtivaId), where('ativo', '==', true), orderBy('nome'));
          const profSnapshot = await getDocs(profQuery);
          setProfessores(profSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professor)));
        } catch (error) {
          console.error("Error fetching professors: ", error);
          toast.error("Sem permissão para carregar professores.");
        }
      }
      fetchProfessores();
    }
  }, [isGestor]);

  // Efeito para carregar turmas baseado no usuário logado (professor) ou selecionado (gestor)
  useEffect(() => {
    const professorId = isGestor ? selectedProfessorId : contextProfessorId;

    if (!professorId || !escolaAtivaId) {
      setTurmas([]);
      setLoading(false);
      return;
    }

    async function fetchTurmas() {
      setLoading(true);
      try {
        console.log("[DiarioDigital] Buscando turmas para:", { escolaAtivaId, professorId });
        
        // Tentamos buscar turmas da escola onde o professor está alocado.
        // Removido o filtro de ano estrito por segurança, ou podemos tentar ambos.
        const turmasQuery = query(
          collection(db, 'turmas'),
          where('escola_id', '==', escolaAtivaId),
          where('professoresIds', 'array-contains', professorId),
          limit(50)
        );
        
        const turmasSnapshot = await getDocs(turmasQuery);
        console.log("[DiarioDigital] Turmas encontradas:", turmasSnapshot.size);
        
        const turmasData = turmasSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              nome: data.nome,
              ano: data.ano,
              componentes: data.componentes || [],
              professoresIds: data.professoresIds || [],
            } as Turma;
          })
          .filter(t => !t.ano || t.ano === new Date().getFullYear()) // Filtro local mais flexível
          .sort((a, b) => a.nome.localeCompare(b.nome));

        setTurmas(turmasData);
        
        if (turmasData.length === 0) {
          console.warn("[DiarioDigital] Nenhuma turma encontrada para o professor nesta escola.");
        }

        // Se a turma restaurada ou selecionada não existe na lista desta escola, limpa a seleção
        if (selectedTurmaId && !turmasData.some(t => t.id === selectedTurmaId) && !isRestoring) {
          setSelectedTurmaId('');
          setSelectedComponente('');
          setComponentes([]);
        }
      } catch (error) {
        toast.error("Sem permissão para carregar as turmas.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchTurmas();
  }, [selectedProfessorId, isGestor, contextProfessorId, escolaAtivaId]);

  // useEffect para persistir os filtros no sessionStorage quando forem alterados
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        professorId: selectedProfessorId,
        turmaId: selectedTurmaId,
        componente: selectedComponente,
      }));
    } catch {
      // ignore
    }
  }, [selectedProfessorId, selectedTurmaId, selectedComponente]);

  // Efeito para resetar seleções quando o professor muda (Gestor)
  useEffect(() => {
    // Pular o reset se estamos restaurando os filtros da sessão anterior
    if (isRestoring) {
      setIsRestoring(false);
      return;
    }
    // Para professores, o ID não muda ativamente via seletor
    if (!isGestor) return;

    setSelectedTurmaId('');
    setSelectedComponente('');
    setComponentes([]);
  }, [selectedProfessorId, isGestor]);

  // Efeito para filtrar componentes quando a turma muda
  useEffect(() => {
    const professorId = isGestor ? selectedProfessorId : contextProfessorId;

    if (selectedTurmaId && professorId) {
      const turmaSelecionada = turmas.find(t => t.id === selectedTurmaId);
      if (turmaSelecionada) {
        const componentesDoProfessor = turmaSelecionada.componentes.filter(d => d.professorId === professorId);
        setComponentes(componentesDoProfessor);

        // BLINDAGEM: Se o componente já selecionado NÃO existe na nova turma/professor, aí sim limpamos.
        // Isso permite que o componente persista se ele for válido para a nova seleção (ou na restauração inicial).
        const aindaValido = componentesDoProfessor.some(c => c.nome === selectedComponente);
        if (!aindaValido && selectedComponente) {
          setSelectedComponente('');
        }
      }
    } else if (!isRestoring) {
      setComponentes([]);
      if (selectedComponente) {
        setSelectedComponente('');
      }
    }
  }, [selectedTurmaId, turmas, isGestor, selectedProfessorId, contextProfessorId, selectedComponente, isRestoring]);

  const selectedTurma = turmas.find(t => t.id === selectedTurmaId);
  const isInfantil = selectedTurma ? ["Crianças Bem Pequenas I", "Crianças Bem Pequenas II", "Crianças Pequenas I", "Crianças Pequenas II"].some(nome => selectedTurma.nome.includes(nome)) : false;

  const cards = [
    {
      title: 'Frequência',
      description: 'Lançar frequência dos Estudantes',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      action: () => selectedTurmaId && navigate(`/turmas/${selectedTurmaId}/frequencia?componente=${encodeURIComponent(selectedComponente || '')}&origem=diario`),
    },
    {
      title: 'Objetos de Conhecimento',
      description: 'Registrar conteúdos e habilidades',
      icon: BookOpen,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      action: () => navigate(selectedTurmaId ? `/diario-digital/objetos-de-conhecimento/${selectedTurmaId}?componente=${encodeURIComponent(selectedComponente || '')}` : '/diario-digital/objetos-de-conhecimento'),
    },
    {
      title: 'Avaliações',
      description: 'Criar e gerenciar avaliações',
      icon: ClipboardList,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      action: () => {
        if (isInfantil) {
          navigate(`/diario-digital/avaliacao-infantil/${selectedTurmaId}/calendario`);
        } else {
          navigate(`/diario-digital/avaliacoes/${selectedTurmaId}?componente=${encodeURIComponent(selectedComponente || '')}`);
        }
      },
    },
    {
      title: 'Notas Parciais',
      description: 'Lançar notas e paralelas',
      icon: GraduationCap,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      action: () => selectedTurmaId && navigate(`/turmas/${selectedTurmaId}/notas-parciais?componente=${encodeURIComponent(selectedComponente || '')}&origem=diario`),
      hide: isInfantil,
    },
  ].filter(card => !card.hide);

  if (roleLoading) {
    return (
      <AppLayout title="Diário Digital">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Diário Digital">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gestão pedagógica completa</p>

        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2.5">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Filtros do Diário</h3>
              {selectedTurmaId && (
                <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Frequentando
                </span>
              )}
            </div>
            
            <OfflineIndicator 
              isSyncing={isSyncing} 
              progress={progress} 
              lastSync={lastSync} 
              onSync={() => startSync(true)} 
            />
          </div>
          <CardContent className="px-5 py-6">
            <div className={`grid grid-cols-1 ${isGestor ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 md:gap-6`}>
              {isGestor && (
                <div className="form-group-compact">
                  <Label className="form-label-compact">Professor(a)</Label>
                  <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione um professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {professores.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>{prof.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="form-group-compact">
                <Label className="form-label-compact">Turma</Label>
                <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId} disabled={loading || turmas.length === 0 || (isGestor && !selectedProfessorId)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={loading ? "Carregando..." : "Selecione uma turma"} />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="form-group-compact">
                <Label className="form-label-compact">Componente Curricular</Label>
                <Select value={selectedComponente} onValueChange={setSelectedComponente} disabled={!selectedTurmaId || isInfantil}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={!selectedTurmaId ? "Selecione uma turma" : "Selecione um componente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {componentes.map((componente) => (
                      <SelectItem key={componente.nome} value={componente.nome}>{componente.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${(!selectedTurmaId || (!selectedComponente && !isInfantil)) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => (selectedTurmaId && (selectedComponente || isInfantil)) && card.action()}
            >
              <CardContent className="pt-6 text-center">
                <div className={`w-16 h-16 rounded-full ${card.bgColor} flex items-center justify-center mx-auto mb-4`}>
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                </div>
                <h4 className="font-semibold text-lg mb-2">{card.title}</h4>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}