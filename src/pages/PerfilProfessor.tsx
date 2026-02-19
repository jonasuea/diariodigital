import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Mail, Phone, Calendar, FileText, BookOpen, GraduationCap, Link as LinkIcon, Pencil } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Professor {
  id: string;
  nome: string;
  disciplina: string;
  matricula: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  foto_url: string | null;
  biografia: string | null;
  link_lattes: string | null;
  status_funcional: string | null;
  data_lotacao: string | null;
  disciplinas: string[] | null;
  series: string[] | null;
  formacoes: { titulo: string; instituicao: string; ano: string }[] | null;
  ativo: boolean;
}

export default function PerfilProfessor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfessor();
    }
  }, [id]);

  async function loadProfessor() {
    setLoading(true);
    if (!id) return;
    try {
      const professorDocRef = doc(db, 'professores', id);
      const professorDoc = await getDoc(professorDocRef);

      if (professorDoc.exists()) {
        setProfessor({ id: professorDoc.id, ...professorDoc.data() } as Professor);
      } else {
        toast.error('Professor não encontrado');
        navigate('/professores');
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do professor');
      console.error(error);
      navigate('/professores');
    }
    setLoading(false);
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Lotado': return 'bg-success text-success-foreground';
      case 'Afastado': return 'bg-muted text-muted-foreground';
      case 'Transferido': return 'bg-warning text-warning-foreground';
      default: return 'bg-success text-success-foreground';
    }
  };

  if (loading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!professor) {
    return (
      <AppLayout title="Professor não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Professor não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/professores')}>
            Voltar para Professores
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Detalhes do Professor">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">
          Visualize informações detalhadas do professor
        </p>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/professores')}>
            <ArrowLeft className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Voltar para Lista de Professores</span>
          </Button>
          <Button onClick={() => navigate(`/professores/${id}/editar`)}>
            <Pencil className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Editar Professor</span>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Card de Informações Pessoais */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={professor.foto_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {professor.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>

              <h2 className="text-xl font-bold">{professor.nome}</h2>
              <p className="text-muted-foreground">Matrícula: {professor.matricula}</p>

              <Badge className={`mt-2 ${getStatusColor(professor.status_funcional)}`}>
                {professor.status_funcional || (professor.ativo ? 'Lotado' : 'Inativo')}
              </Badge>

              <div className="w-full mt-6 space-y-4 text-left">
                {professor.data_lotacao && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Lotação</p>
                      <p className="font-medium">
                        {format(new Date(professor.data_lotacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{professor.email}</p>
                  </div>
                </div>

                {professor.telefone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{professor.telefone}</p>
                    </div>
                  </div>
                )}

                {professor.cpf && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">CPF</p>
                      <p className="font-medium">{professor.cpf}</p>
                    </div>
                  </div>
                )}

                {professor.rg && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">RG</p>
                      <p className="font-medium">{professor.rg}</p>
                    </div>
                  </div>
                )}

                {professor.link_lattes && (
                  <div className="flex items-start gap-3">
                    <LinkIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Currículo Lattes</p>
                      <a href={professor.link_lattes} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Acessar Lattes
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card de Informações Acadêmicas */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Informações Acadêmicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Disciplinas */}
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Disciplinas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {professor.disciplinas && professor.disciplinas.length > 0 ? (
                    professor.disciplinas.map((disc, i) => (
                      <Badge key={i} variant="secondary">{disc}</Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">{professor.disciplina}</Badge>
                  )}
                </div>
              </div>

              {/* Séries */}
              {professor.series && professor.series.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Séries que Leciona
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {professor.series.map((serie, i) => (
                      <Badge key={i} variant="outline">{serie}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Formações */}
              {professor.formacoes && professor.formacoes.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Formação Acadêmica
                  </h4>
                  <div className="space-y-3">
                    {professor.formacoes.map((formacao, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <p className="font-medium">{formacao.titulo}</p>
                        <p className="text-sm text-muted-foreground">{formacao.instituicao}</p>
                        <p className="text-sm text-muted-foreground">{formacao.ano}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Biografia */}
              {professor.biografia && (
                <div>
                  <h4 className="font-semibold mb-3">Biografia</h4>
                  <p className="text-muted-foreground">{professor.biografia}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
