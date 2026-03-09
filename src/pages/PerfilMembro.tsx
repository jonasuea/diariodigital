import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Mail, Phone, GraduationCap, Calendar, FileText, User, Pencil, Link as LinkIcon } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Formacao {
  id: string;
  curso: string;
  nivel: string;
  ano_conclusao: string;
}

interface Membro {
  id: string;
  nome: string;
  cargo: string;
  matricula: string;
  email: string;
  contato: string | null;
  status: string;
  foto_url: string | null;
  rg: string | null;
  cpf: string | null;
  data_lotacao: string | null;
  formacoes: Formacao[] | null;
  biografia: string | null;
  link_lattes: string | null;
}

export default function PerfilMembro() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadMembro();
    }
  }, [id]);

  async function loadMembro() {
    setLoading(true);
    if (!id) return;

    try {
      const membroDocRef = doc(db, 'equipe_gestora', id);
      const membroDoc = await getDoc(membroDocRef);

      if (membroDoc.exists()) {
        setMembro({ id: membroDoc.id, ...membroDoc.data() } as Membro);
      } else {
        toast.error('Membro não encontrado');
        navigate('/equipe-gestora');
      }
    } catch (error) {
      toast.error('Sem permissão para carregar membro');
      console.error(error);
      navigate('/equipe-gestora');
    }

    setLoading(false);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lotado': return 'bg-success text-success-foreground';
      case 'Temporário': return 'bg-warning text-warning-foreground';
      case 'Afastado': return 'bg-muted text-muted-foreground';
      case 'Transferido': return 'bg-info text-info-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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

  if (!membro) {
    return (
      <AppLayout title="Membro não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Membro da equipe gestora não encontrado.</p>
          <Button className="mt-4" onClick={() => navigate('/equipe-gestora')}>
            Voltar para Equipe Gestora
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  let dataLotacaoValida = null;
  if (membro.data_lotacao) {
    try {
      const parsedDate = parseISO(membro.data_lotacao);
      if (!isNaN(parsedDate.getTime())) {
        dataLotacaoValida = format(parsedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }
    } catch (e) {
      console.warn("Data de lotação inválida", membro.data_lotacao);
    }
  }

  return (
    <AppLayout title="Detalhes do Membro da Equipe">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">
          Visualize informações detalhadas do membro da equipe gestora
        </p>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Voltar</span>
          </Button>
          <Button onClick={() => navigate(`/equipe-gestora/${id}/editar`)}>
            <Pencil className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Editar Membro</span>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Card de Informações Pessoais */}
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={membro.foto_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {membro.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>

              <h2 className="text-xl font-bold">{membro.nome}</h2>
              <p className="text-muted-foreground">Matrícula: {membro.matricula}</p>

              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{membro.cargo}</Badge>
                <Badge className={getStatusColor(membro.status)}>
                  {membro.status}
                </Badge>
              </div>

              <div className="w-full mt-6 pt-6 border-t space-y-4 text-left">
                <InfoItem icon={Mail} label="E-mail" value={membro.email} />
                <InfoItem icon={Phone} label="Contato" value={membro.contato} />
                <InfoItem icon={FileText} label="CPF" value={membro.cpf} />
                <InfoItem icon={FileText} label="RG" value={membro.rg} />
                <InfoItem
                  icon={Calendar}
                  label="Data de Lotação"
                  value={dataLotacaoValida || 'Não informada'}
                />
                <InfoItem icon={LinkIcon} label="Currículo Lattes" value={membro.link_lattes} isLink />
              </div>
            </CardContent>
          </Card>

          {/* Card de Informações Acadêmicas e Biografia */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Acadêmicas</CardTitle>
              </CardHeader>
              <CardContent>
                {membro.formacoes && membro.formacoes.length > 0 ? (
                  <div className="space-y-3">
                    {membro.formacoes.map((formacao, i) => (
                      <div key={i} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-base">{formacao.curso}</p>
                          <p className="text-sm text-muted-foreground">{formacao.nivel}</p>
                          <p className="text-xs text-muted-foreground mt-1">Concluído em {formacao.ano_conclusao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma formação acadêmica registrada.</p>
                )}
              </CardContent>
            </Card>

            {membro.biografia && (
              <Card>
                <CardHeader>
                  <CardTitle>Biografia</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{membro.biografia}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}