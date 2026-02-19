import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar, MapPin, Phone, Mail, FileText, Download, ClipboardList, Edit } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  data_nascimento: string | null;
  status: string | null;
  foto_url: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  telefone?: string | null;
  mae_nome: string | null;
  mae_contato: string | null;
  mae_email: string | null;
  pai_nome: string | null;
  pai_contato: string | null;
  pai_email: string | null;
  largura_farda: string | null;
  altura_farda: string | null;
  pasta: string | null;
  prateleira: string | null;
  turma_id: string | null;
  ano: number;
  turma_nome?: string;
}

interface Nota {
  id: string;
  disciplina: string;
  bimestre_1: number | null;
  bimestre_2: number | null;
  bimestre_3: number | null;
  bimestre_4: number | null;
  media_anual: number | null;
  situacao: string | null;
}

const DEFAULT_TRANSFERENCIA_TEMPLATE = `DECLARAÇÃO DE TRANSFERÊNCIA

Declaramos, para os devidos fins, que o(a) aluno(a) {NOME_ALUNO}, portador(a) do RG nº __________, inscrito(a) no CPF sob o nº __________, matriculado(a) nesta instituição sob o número {MATRICULA}, cursou regularmente o {SERIE} do Ensino {NIVEL} durante o ano letivo de {ANO}.

O(A) referido(a) aluno(a) está sendo transferido(a) a pedido do responsável, estando quite com todas as obrigações escolares.

Por ser verdade, firmamos a presente declaração.

{CIDADE}, {DATA}

_______________________________
Diretor(a)

_______________________________
Secretário(a)`;

const DEFAULT_BOLETIM_TEMPLATE = `BOLETIM ESCOLAR

Escola Municipal Dom Paulo McHugh
Ano Letivo: {ANO}

DADOS DO ALUNO:
Nome: {NOME_ALUNO}
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

export default function PerfilAluno() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('notas');
  
  const [transferenciaDialogOpen, setTransferenciaDialogOpen] = useState(false);
  const [transferenciaTemplate, setTransferenciaTemplate] = useState(DEFAULT_TRANSFERENCIA_TEMPLATE);
  
  const [boletimDialogOpen, setBoletimDialogOpen] = useState(false);
  const [boletimTemplate, setBoletimTemplate] = useState(DEFAULT_BOLETIM_TEMPLATE);

  useEffect(() => {
    if (id) {
      loadAluno();
    }
  }, [id]);

  useEffect(() => {
    if (aluno) {
      loadNotas();
    }
  }, [aluno, selectedYear]);

  async function loadAluno() {
    setLoading(true);
    if (!id) return;
    try {
      const alunoDocRef = doc(db, 'alunos', id);
      const alunoDoc = await getDoc(alunoDocRef);

      if (alunoDoc.exists()) {
        const alunoData = alunoDoc.data() as Omit<Aluno, 'id' | 'turma_nome'>;
        let turma_nome: string | undefined = '-';

        if (alunoData.turma_id) {
          const turmaDocRef = doc(db, 'turmas', alunoData.turma_id);
          const turmaDoc = await getDoc(turmaDocRef);
          if (turmaDoc.exists()) {
            turma_nome = turmaDoc.data().nome;
          }
        }
        
        setAluno({
          id: alunoDoc.id,
          ...alunoData,
          turma_nome
        });
      } else {
        toast.error('Aluno não encontrado');
        navigate('/alunos');
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do aluno');
      console.error(error);
      navigate('/alunos');
    }
    setLoading(false);
  }

  async function loadNotas() {
    if (!aluno) return;
    
    try {
      const q = query(
        collection(db, 'notas'), 
        where('aluno_id', '==', aluno.id), 
        where('ano', '==', selectedYear)
      );
      const querySnapshot = await getDocs(q);
      const notasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nota));
      setNotas(notasData.sort((a,b) => a.disciplina.localeCompare(b.disciplina)));
    } catch (error) {
      console.error("Error fetching notes: ", error);
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Ativo':
      case 'Frequentando':
        return 'bg-success text-success-foreground';
      case 'Transferido':
        return 'bg-warning text-warning-foreground';
      case 'Inativo':
      case 'Desistente':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-success text-success-foreground';
    }
  };

  const getNotaColor = (nota: number | null) => {
    if (nota === null) return '';
    if (nota >= 8) return 'bg-green-100 text-green-800';
    if (nota >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  function handleGerarTransferencia() {
    if (!aluno) return;

    const doc = new jsPDF();
    const ano = new Date().getFullYear();
    const cidade = aluno.cidade || 'Manaus';
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    let conteudo = transferenciaTemplate
      .replace('{NOME_ALUNO}', aluno.nome)
      .replace('{MATRICULA}', aluno.matricula)
      .replace('{SERIE}', aluno.turma_nome || `${aluno.ano}º Ano`)
      .replace('{NIVEL}', aluno.ano <= 5 ? 'Fundamental I' : 'Fundamental II')
      .replace('{ANO}', ano.toString())
      .replace('{CIDADE}', cidade)
      .replace('{DATA}', dataAtual);

    const lines = doc.splitTextToSize(conteudo, 180);
    doc.setFontSize(12);
    doc.text(lines, 15, 30);
    doc.save(`transferencia-${aluno.nome.replace(/\s+/g, '-')}.pdf`);
    toast.success('Declaração de transferência gerada!');
    setTransferenciaDialogOpen(false);
  }

  function handleGerarBoletim() {
    if (!aluno) return;

    const doc = new jsPDF();
    const ano = selectedYear;

    let notasTexto = '';
    let totalMedia = 0;
    let countMedia = 0;

    notas.forEach(nota => {
      notasTexto += `${nota.disciplina}: 1º Bim: ${nota.bimestre_1?.toFixed(1) || '-'} | 2º Bim: ${nota.bimestre_2?.toFixed(1) || '-'} | 3º Bim: ${nota.bimestre_3?.toFixed(1) || '-'} | 4º Bim: ${nota.bimestre_4?.toFixed(1) || '-'} | Média: ${nota.media_anual?.toFixed(1) || '-'}\n`;
      if (nota.media_anual != null) {
        totalMedia += nota.media_anual;
        countMedia++;
      }
    });

    const mediaGeral = countMedia > 0 ? (totalMedia / countMedia).toFixed(1) : '-';
    const situacao = countMedia > 0 && totalMedia / countMedia >= 6 ? 'Aprovado' : 'Em andamento';

    let conteudo = boletimTemplate
      .replace('{ANO}', ano.toString())
      .replace('{NOME_ALUNO}', aluno.nome)
      .replace('{MATRICULA}', aluno.matricula)
      .replace('{TURMA}', aluno.turma_nome || `${aluno.ano}º Ano`)
      .replace('{NOTAS}', notasTexto || 'Nenhuma nota registrada')
      .replace('{MEDIA_GERAL}', mediaGeral)
      .replace('{SITUACAO}', situacao)
      .replace('{DATA_EMISSAO}', new Date().toLocaleDateString('pt-BR'));

    const lines = doc.splitTextToSize(conteudo, 180);
    doc.setFontSize(12);
    doc.text(lines, 15, 20);
    doc.save(`boletim-${aluno.nome.replace(/\s+/g, '-')}-${ano}.pdf`);
    toast.success('Boletim gerado com sucesso!');
    setBoletimDialogOpen(false);
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

  if (!aluno) {
    return (
      <AppLayout title="Aluno não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aluno não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/alunos')}>
            Voltar para Alunos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const endereco = [aluno.endereco, aluno.bairro, aluno.cidade, aluno.estado]
    .filter(Boolean)
    .join(', ');

  return (
    <AppLayout title="Detalhes do Aluno">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">
          Visualize informações detalhadas, notas e frequência do aluno
        </p>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="outline" onClick={() => navigate('/alunos')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Lista de Alunos
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setTransferenciaDialogOpen(true)}>
              <Edit className="h-4 w-4" />
              Editar Transferência
            </Button>
            <Button variant="default" className="gap-2" onClick={handleGerarTransferencia}>
              <Download className="h-4 w-4" />
              Gerar Transferência
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Card de Informações Pessoais */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={aluno.foto_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {aluno.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>

              <h2 className="text-xl font-bold">{aluno.nome}</h2>
              <p className="text-muted-foreground">Matrícula: {aluno.matricula}</p>

              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">{aluno.turma_nome || `${aluno.ano}º Ano`}</Badge>
                <Badge className={getStatusColor(aluno.status)}>
                  {aluno.status || 'Frequentando'}
                </Badge>
              </div>

              <div className="w-full mt-6 space-y-4 text-left">
                {aluno.data_nascimento && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                      <p className="font-medium">
                        {format(new Date(aluno.data_nascimento), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}

                {endereco && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">{endereco}</p>
                    </div>
                  </div>
                )}

                {(aluno.mae_contato || aluno.pai_contato) && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{aluno.mae_contato || aluno.pai_contato}</p>
                      {aluno.mae_contato && aluno.pai_contato && (
                        <>
                          <p className="text-sm text-muted-foreground mt-1">Telefone do Responsável</p>
                          <p className="font-medium">{aluno.pai_contato}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {(aluno.mae_email || aluno.pai_email) && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium break-all">{aluno.mae_email || aluno.pai_email}</p>
                      {aluno.mae_email && aluno.pai_email && (
                        <>
                          <p className="text-sm text-muted-foreground mt-1">Email do Responsável</p>
                          <p className="font-medium break-all">{aluno.pai_email}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-3">Informações Adicionais</h4>
                  
                  {(aluno.largura_farda || aluno.altura_farda) && (
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tamanho da Farda</p>
                        <p className="font-medium">
                          {aluno.largura_farda && `Largura: ${aluno.largura_farda}`}
                          {aluno.largura_farda && aluno.altura_farda && ' | '}
                          {aluno.altura_farda && `Altura: ${aluno.altura_farda}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {aluno.pasta && (
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Pasta</p>
                        <p className="font-medium">{aluno.pasta}</p>
                      </div>
                    </div>
                  )}

                  {aluno.prateleira && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Prateleira</p>
                        <p className="font-medium">{aluno.prateleira}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de Desempenho Acadêmico */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Desempenho Acadêmico</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Ano:</span>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {[2023, 2024, 2025].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="notas" className="gap-1">
                      <ClipboardList className="h-4 w-4" />
                      Notas
                    </TabsTrigger>
                    <TabsTrigger value="frequencia" className="gap-1">
                      <Calendar className="h-4 w-4" />
                      Frequência
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'notas' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold">Boletim</h4>
                      <p className="text-sm text-muted-foreground">Notas por disciplina</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span>≥ 8</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-yellow-500" />
                        <span>6-7.9</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>&lt; 6</span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Disciplina</th>
                          <th className="text-center p-3 font-medium">1º Bim</th>
                          <th className="text-center p-3 font-medium">2º Bim</th>
                          <th className="text-center p-3 font-medium">3º Bim</th>
                          <th className="text-center p-3 font-medium">4º Bim</th>
                          <th className="text-center p-3 font-medium">Média</th>
                          <th className="text-center p-3 font-medium">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notas.length > 0 ? notas.map((nota) => (
                          <tr key={nota.id} className="border-t">
                            <td className="p-3 font-medium">{nota.disciplina}</td>
                            <td className={`p-3 text-center ${getNotaColor(nota.bimestre_1)}`}>
                              {nota.bimestre_1?.toFixed(1) || '-'}
                            </td>
                            <td className={`p-3 text-center ${getNotaColor(nota.bimestre_2)}`}>
                              {nota.bimestre_2?.toFixed(1) || '-'}
                            </td>
                            <td className={`p-3 text-center ${getNotaColor(nota.bimestre_3)}`}>
                              {nota.bimestre_3?.toFixed(1) || '-'}
                            </td>
                            <td className={`p-3 text-center ${getNotaColor(nota.bimestre_4)}`}>
                              {nota.bimestre_4?.toFixed(1) || '-'}
                            </td>
                            <td className={`p-3 text-center font-semibold ${getNotaColor(nota.media_anual)}`}>
                              {nota.media_anual?.toFixed(1) || '-'}
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant={nota.situacao === 'Aprovado' ? 'default' : 'secondary'}>
                                {nota.situacao || 'Cursando'}
                              </Badge>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
                              Nenhuma nota registrada para este ano
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end mt-4 gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setBoletimDialogOpen(true)}>
                      <Edit className="h-4 w-4" />
                      Editar Modelo
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleGerarBoletim}>
                      <FileText className="h-4 w-4" />
                      Gerar Boletim
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'frequencia' && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Dados de frequência serão exibidos aqui</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para editar modelo de transferência */}
      <Dialog open={transferenciaDialogOpen} onOpenChange={setTransferenciaDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Modelo de Transferência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Variáveis disponíveis: {'{NOME_ALUNO}'}, {'{MATRICULA}'}, {'{SERIE}'}, {'{NIVEL}'}, {'{ANO}'}, {'{CIDADE}'}, {'{DATA}'}
            </div>
            <Textarea
              value={transferenciaTemplate}
              onChange={(e) => setTransferenciaTemplate(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferenciaTemplate(DEFAULT_TRANSFERENCIA_TEMPLATE)}>
              Restaurar Padrão
            </Button>
            <Button onClick={handleGerarTransferencia}>
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar modelo do boletim */}
      <Dialog open={boletimDialogOpen} onOpenChange={setBoletimDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Modelo do Boletim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Variáveis disponíveis: {'{ANO}'}, {'{NOME_ALUNO}'}, {'{MATRICULA}'}, {'{TURMA}'}, {'{NOTAS}'}, {'{MEDIA_GERAL}'}, {'{SITUACAO}'}, {'{DATA_EMISSAO}'}
            </div>
            <Textarea
              value={boletimTemplate}
              onChange={(e) => setBoletimTemplate(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoletimTemplate(DEFAULT_BOLETIM_TEMPLATE)}>
              Restaurar Padrão
            </Button>
            <Button onClick={handleGerarBoletim}>
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
