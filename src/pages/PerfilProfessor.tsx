import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  Mail,
  Pencil,
  Phone,
  Users,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Formacao {
  id: string;
  curso: string;
  nivel: string;
  ano_conclusao: string;
}

interface Professor {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  telefone: string | null;
  status_funcional: string;
  foto_url: string | null;
  data_lotacao: string | null;
  formacoes: Formacao[] | null;
  biografia: string | null;
  link_lattes: string | null;
  componentes?: string[];
  series?: string[];
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
}

interface TurmaLecionada {
  id: string;
  nome: string;
  serie: string;
  componentes: string[];
}

const InfoItem = ({ icon: Icon, label, value, isLink = false }: { icon: React.ElementType; label: string; value?: string | null, isLink?: boolean }) => (
  value ? (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {isLink ? <a href={value} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline break-all">{value}</a> : <p className="font-medium">{value}</p>}
      </div>
    </div>
  ) : null
);

export default function PerfilProfessor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [turmasLecionadas, setTurmasLecionadas] = useState<TurmaLecionada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfessorData();
    }
  }, [id]);

  async function loadProfessorData() {
    if (!id) return;
    setLoading(true);
    try {
      const professorDocRef = doc(db, 'professores', id);
      const [professorDoc, turmasSnap] = await Promise.all([
        getDoc(professorDocRef),
        getDocs(query(collection(db, 'turmas'), where('professoresIds', 'array-contains', id)))
      ]);

      if (professorDoc.exists()) {
        setProfessor({ id: professorDoc.id, ...professorDoc.data() } as Professor);
      } else {
        toast.error('Professor não encontrado');
        navigate('/professores');
        return;
      }

      const turmasData: TurmaLecionada[] = turmasSnap.docs.map(doc => {
        const turma = doc.data();
        const componentesDoProfessor = (turma.componentes || [])
          .filter((c: { professorId: string }) => c.professorId === id)
          .map((c: { nome: string }) => c.nome);

        return { id: doc.id, nome: turma.nome, serie: turma.serie, componentes: componentesDoProfessor };
      }).filter(t => t.componentes.length > 0);

      setTurmasLecionadas(turmasData);
    } catch (error) {
      toast.error('Erro ao carregar dados do professor');
      console.error(error);
      navigate('/professores');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Lotado': return 'bg-green-100 text-green-800';
      case 'Afastado': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      </AppLayout>
    );
  }

  if (!professor) {
    return (
      <AppLayout title="Professor não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Professor não encontrado.</p>
          <Button className="mt-4" onClick={() => navigate('/professores')}>Voltar para a Lista</Button>
        </div>
      </AppLayout>
    );
  }

  const enderecoArr = [professor.logradouro, professor.numero, professor.bairro].filter(Boolean);
  let enderecoCompleto = enderecoArr.length > 0 ? enderecoArr.join(', ') : 'Não cadastrado';
  if (professor.cep) enderecoCompleto += ` - CEP: ${professor.cep}`;

  let dataLotacaoValida = null;
  if (professor.data_lotacao) {
    try {
      // Tenta fazer o parse e garantir que é válido antes de chamar o format
      const parsedDate = parseISO(professor.data_lotacao);
      if (!isNaN(parsedDate.getTime())) {
        dataLotacaoValida = format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
      }
    } catch (e) {
      console.warn("Data de lotação inválida", professor.data_lotacao);
    }
  }

  return (
    <AppLayout title="Detalhes do Professor">
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            Visualize informações detalhadas do professor e suas turmas
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/professores')} className="rounded-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Lista de Professores
            </Button>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
          {/* Coluna da Esquerda: Informações Pessoais */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                <Avatar className="h-28 w-28 mb-4 border-4 border-background shadow-sm">
                  <AvatarImage src={professor.foto_url || undefined} />
                  <AvatarFallback className="text-2xl bg-muted text-muted-foreground">
                    {professor.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold mb-1">{professor.nome}</h2>
                <p className="text-sm text-muted-foreground mb-3">Matrícula: {professor.matricula}</p>
                <Badge className={`rounded-full px-4 mb-2 ${getStatusColor(professor.status_funcional)}`}>
                  {professor.status_funcional}
                </Badge>
                {dataLotacaoValida && (
                  <p className="text-xs text-muted-foreground mb-6">
                    Membro desde: {dataLotacaoValida}
                  </p>
                )}

                <div className="w-full space-y-6 text-left">
                  <InfoItem
                    icon={GraduationCap}
                    label="Formação"
                    value={professor.formacoes?.[0]?.curso || 'Não informada'}
                  />
                  <InfoItem
                    icon={FileText}
                    label="Endereço"
                    value={enderecoCompleto}
                  />
                  <InfoItem
                    icon={Phone}
                    label="Telefone"
                    value={professor.telefone || 'Não cadastrado'}
                  />
                  <InfoItem
                    icon={Mail}
                    label="Email"
                    value={professor.email}
                  />
                  {professor.link_lattes && (
                    <InfoItem
                      icon={LinkIcon}
                      label="Currículo Lattes"
                      value={professor.link_lattes}
                      isLink={true}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna da Direita: Perfil Profissional e Turmas */}
          <div className="lg:col-span-8">
            <Card className="shadow-sm border-border/50 h-full min-h-[500px]">
              <Tabs defaultValue="academico" className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <h2 className="text-2xl font-bold tracking-tight">Perfil Profissional</h2>
                  <TabsList className="bg-muted/50 rounded-full h-10 p-1">
                    <TabsTrigger value="academico" className="rounded-full px-4 text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      Perfil
                    </TabsTrigger>
                    <TabsTrigger value="turmas" className="rounded-full px-4 text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <BookOpen className="h-4 w-4" />
                      Turmas
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab: Perfil Profissional */}
                <TabsContent value="academico" className="flex-1 p-6 m-0 outline-none">
                  <div className="space-y-8">
                    {/* Biografia */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Biografia</h3>
                      {professor.biografia ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {professor.biografia}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nenhuma biografia registrada.</p>
                      )}
                    </div>

                    {/* Formação Acadêmica */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Formação Acadêmica</h3>
                      {professor.formacoes && professor.formacoes.length > 0 ? (
                        <div className="space-y-3">
                          {professor.formacoes.map((formacao) => (
                            <div key={formacao.id} className="p-3 border border-border/50 rounded-lg bg-card/50">
                              <p className="font-medium text-sm text-foreground">{formacao.curso}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formacao.nivel} • Concluído em {formacao.ano_conclusao}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nenhuma formação registrada.</p>
                      )}
                    </div>

                    {/* Disciplinas */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Disciplinas</h3>
                      <div className="flex flex-wrap gap-2">
                        {professor.componentes && professor.componentes.length > 0 ? (
                          professor.componentes.map((comp) => (
                            <Badge key={comp} variant="secondary" className="px-3 py-1 bg-muted text-foreground text-xs font-medium rounded-full hover:bg-muted/80">
                              {comp}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Geral</span>
                        )}
                      </div>
                    </div>

                    {/* Séries */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Séries</h3>
                      <div className="flex flex-wrap gap-2">
                        {professor.series && professor.series.length > 0 ? (
                          professor.series.map((serie) => (
                            <Badge key={serie} variant="outline" className="px-3 py-1 bg-green-50/50 text-green-800 border-green-200 text-xs font-medium rounded-full">
                              {serie}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Não informadas</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Turmas */}
                <TabsContent value="turmas" className="flex-1 p-6 m-0 outline-none">
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold">Turmas Lecionadas</h3>
                    {turmasLecionadas.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {turmasLecionadas.map(turma => (
                          <div key={turma.id} className="p-4 border border-border/50 rounded-xl bg-card hover:shadow-sm transition-all">
                            <h4 className="font-semibold flex items-center gap-2 mb-3">
                              <Users className="h-4 w-4 text-primary" />
                              {turma.nome}
                              <span className="text-muted-foreground font-normal text-sm">({turma.serie})</span>
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {turma.componentes.map(comp => (
                                <Badge key={comp} variant="secondary" className="text-xs font-normal">
                                  {comp}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma turma alocada para este professor.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}