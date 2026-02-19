import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, GraduationCap, Calendar, FileText, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

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
  telefone: string | null;
  status: string;
  foto_url: string | null;
  rg: string | null;
  cpf: string | null;
  data_lotacao: string | null;
  formacoes: Formacao[] | null;
  biografia: string | null;
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
      toast.error('Erro ao carregar membro');
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

  const getCargoColor = (cargo: string) => {
    switch (cargo) {
      case 'Diretor': return 'bg-primary text-primary-foreground';
      case 'Coordenador Pedagógico': return 'bg-success text-success-foreground';
      case 'Secretário': return 'bg-info text-info-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <AppLayout title="Perfil">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!membro) return null;

  return (
    <AppLayout title="Equipe Gestora">
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/equipe-gestora')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        {/* Header com foto e info básica */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-border overflow-hidden">
                {membro.foto_url ? (
                  <img src={membro.foto_url} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-16 w-16 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-foreground">{membro.nome}</h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <Badge className={getCargoColor(membro.cargo)}>{membro.cargo}</Badge>
                  <Badge className={getStatusColor(membro.status)}>{membro.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-2">Matrícula: {membro.matricula}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contato */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span>{membro.email}</span>
              </div>
              {membro.telefone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <span>{membro.telefone}</span>
                </div>
              )}
              {membro.data_lotacao && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span>Lotado em: {new Date(membro.data_lotacao).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {membro.rg && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span>RG: {membro.rg}</span>
                </div>
              )}
              {membro.cpf && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span>CPF: {membro.cpf}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Formações */}
        {membro.formacoes && membro.formacoes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Formação Acadêmica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {membro.formacoes.map((formacao, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold">{formacao.curso}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formacao.nivel} • Conclusão: {formacao.ano_conclusao}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Biografia */}
        {membro.biografia && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Biografia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{membro.biografia}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}