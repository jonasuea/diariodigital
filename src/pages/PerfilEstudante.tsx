import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Phone,
  Mail,
  FileText,
  Download,
  ClipboardList,
  Shirt,
  Box,
  Contact,
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


// Interfaces
interface Estudante {
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
  componente: string;
  professor_nome: string;
  bimestre_1: number | null;
  bimestre_2: number | null;
  bimestre_3: number | null;
  bimestre_4: number | null;
  media_anual: number | null;
  situacao: 'Aprovado' | 'Reprovado' | 'Recuperação' | 'Cursando' | string | null;
}


// Componente Principal
export default function PerfilEstudante() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [estudante, setEstudante] = useState<Estudante | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('notas');

  useEffect(() => {
    if (id) {
      loadEstudanteData();
    }
  }, [id, selectedYear]);

  async function loadEstudanteData() {
    if (!id) return;
    setLoading(true);
    try {
      const estudanteDocRef = doc(db, 'estudantes', id);
      const estudanteDoc = await getDoc(estudanteDocRef);

      if (!estudanteDoc.exists()) {
        toast.error('Estudante não encontrado');
        navigate('/estudantes');
        return;
      }

      const estudanteData = estudanteDoc.data() as Omit<Estudante, 'id'>;
      let turma_nome = '-';
      if (estudanteData.turma_id) {
        const turmaDoc = await getDoc(doc(db, 'turmas', estudanteData.turma_id));
        if (turmaDoc.exists()) {
          turma_nome = turmaDoc.data().nome;
        }
      }

      setEstudante({ id: estudanteDoc.id, ...estudanteData, turma_nome });

      const notasQuery = query(
        collection(db, 'notas'),
        where('estudante_id', '==', id),
        where('ano', '==', parseInt(selectedYear))
      );
      const notasSnapshot = await getDocs(notasQuery);
      // Mock de professores para o design
      const mockProfessores = [
          "André Pinheiro", "Camila Santos", "Rafael Moreira", "Beatriz Oliveira",
          "Gabriel Costa", "Sofia Lima", "Marcos Alves", "Luísa Cardoso"
      ];
      const notasData = notasSnapshot.docs.map((doc, index) => ({ 
          id: doc.id, 
          ...doc.data(),
          professor_nome: mockProfessores[index % mockProfessores.length] // Adiciona mock
      } as Nota));
      setNotas(notasData);

    } catch (error) {
      toast.error('Erro ao carregar dados do estudante');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  
  const getNotaColor = (nota: number | null) => {
    if (nota === null || nota === undefined) return '';
    if (nota >= 8) return 'bg-green-100 text-green-900 font-semibold';
    if (nota >= 6) return 'bg-yellow-100 text-yellow-900 font-semibold';
    return 'bg-red-100 text-red-900 font-semibold';
  };

  const InfoItem = ({ icon: Icon, label, value, subValue }: { icon: React.ElementType; label: string; value?: string | null, subValue?: string | null }) => (
    value ? (
        <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{value}</p>
                {subValue && <p className="text-sm text-muted-foreground">{subValue}</p>}
            </div>
        </div>
    ) : null
  );

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
          <Button className="mt-4" onClick={() => navigate('/estudantes')}>Voltar para Lista de Alunos</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
        <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Detalhes do Aluno</h2>
                    <p className="text-muted-foreground">Visualize informações detalhadas, notas e frequência do aluno.</p>
                </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4">
                <Button variant="outline" onClick={() => navigate('/estudantes')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar para Lista de Alunos
                </Button>
                <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Transferência
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Coluna de Informações Pessoais */}
                <div className="lg:col-span-4">
                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle>Informações Pessoais</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center text-center">
                                <Avatar className="h-24 w-24 mb-4">
                                    <AvatarImage src={estudante.foto_url || undefined} />
                                    <AvatarFallback className="text-3xl bg-muted">
                                        {estudante.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                    </AvatarFallback>
                                </Avatar>
                                <h3 className="text-xl font-bold">{estudante.nome}</h3>
                                <p className="text-sm text-muted-foreground">Matrícula: {estudante.matricula}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">{estudante.turma_nome || `${estudante.ano}º Ano`}</Badge>
                                    <Badge variant="default" className="bg-green-100 text-green-800">
                                        {estudante.status || 'Frequentando'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4 pt-4 border-t">
                                <InfoItem icon={Calendar} label="Data de Nascimento" value={estudante.data_nascimento ? format(new Date(estudante.data_nascimento), "dd/MM/yyyy") : null} />
                                <InfoItem icon={MapPin} label="Endereço" value={[estudante.endereco, estudante.bairro, estudante.cidade, estudante.estado].filter(Boolean).join(', ')} />
                                <InfoItem icon={Phone} label="Telefone" value={estudante.telefone} />
                                <InfoItem icon={Contact} label="Telefone do Responsável" value={estudante.mae_contato || estudante.pai_contato} />
                                <InfoItem icon={Mail} label="Email" value={estudante.mae_email} />
                                <InfoItem icon={Mail} label="Email do Responsável" value={estudante.pai_email} />
                            </div>

                             <div className="mt-6 pt-4 border-t">
                                <h4 className="font-semibold mb-3 text-md">Informações Adicionais</h4>
                                <div className="space-y-4">
                                    <InfoItem icon={Shirt} label="Tamanho da Farda" value={estudante.largura_farda && estudante.altura_farda ? `Largura: ${estudante.largura_farda}cm | Altura: ${estudante.altura_farda}cm` : null} />
                                    <InfoItem icon={FileText} label="Pasta" value={estudante.pasta} />
                                    <InfoItem icon={Box} label="Prateleira" value={estudante.prateleira} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Coluna de Desempenho Acadêmico */}
                <div className="lg:col-span-8">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <CardTitle>Desempenho Acadêmico</CardTitle>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Ano:</span>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[2023, 2024, 2025, 2026, 2027].map(year => (
                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-4">
                                        <TabsList>
                                            <TabsTrigger value="notas"><ClipboardList className="h-4 w-4 mr-2" />Notas</TabsTrigger>
                                            <TabsTrigger value="frequencia"><Calendar className="h-4 w-4 mr-2" />Frequência</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <TabsContent value="notas">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-semibold">Boletim</h4>
                                        <p className="text-sm text-muted-foreground">Notas por disciplina</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400" /> ≥ 8</div>
                                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400" /> 6-7.9</div>
                                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /> &lt; 6</div>
                                    </div>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="font-semibold">Disciplina</TableHead>
                                                <TableHead className="font-semibold">Professor</TableHead>
                                                <TableHead className="text-center font-semibold">1º Bim</TableHead>
                                                <TableHead className="text-center font-semibold">2º Bim</TableHead>
                                                <TableHead className="text-center font-semibold">3º Bim</TableHead>
                                                <TableHead className="text-center font-semibold">4º Bim</TableHead>
                                                <TableHead className="text-center font-semibold">Média</TableHead>
                                                <TableHead className="text-center font-semibold">Situação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notas.length > 0 ? notas.map((nota) => (
                                            <TableRow key={nota.id}>
                                                <TableCell className="font-medium">{nota.componente}</TableCell>
                                                <TableCell className="text-muted-foreground">{nota.professor_nome}</TableCell>
                                                <TableCell className={`text-center rounded-md p-0 m-2 ${getNotaColor(nota.bimestre_1)}`}>{nota.bimestre_1?.toFixed(1) ?? '-'}</TableCell>
                                                <TableCell className={`text-center rounded-md p-0 m-2 ${getNotaColor(nota.bimestre_2)}`}>{nota.bimestre_2?.toFixed(1) ?? '-'}</TableCell>
                                                <TableCell className={`text-center rounded-md p-0 m-2 ${getNotaColor(nota.bimestre_3)}`}>{nota.bimestre_3?.toFixed(1) ?? '-'}</TableCell>
                                                <TableCell className={`text-center rounded-md p-0 m-2 ${getNotaColor(nota.bimestre_4)}`}>{nota.bimestre_4?.toFixed(1) ?? '-'}</TableCell>
                                                <TableCell className={`text-center rounded-md p-0 m-2 ${getNotaColor(nota.media_anual)}`}>{nota.media_anual?.toFixed(1) ?? '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={nota.situacao === 'Aprovado' ? 'default' : 'secondary'} className="capitalize bg-green-100 text-green-800">
                                                        {nota.situacao?.toLowerCase() || 'Cursando'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                            )) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center">Nenhuma nota registrada para este ano.</TableCell>
                                            </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex justify-end mt-6">
                                    <Button variant="outline">
                                        <Download className="h-4 w-4 mr-2" />
                                        Gerar Boletim
                                    </Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="frequencia">
                                 <div className="text-center py-12">
                                    <p className="text-muted-foreground">A funcionalidade de frequência será implementada em breve.</p>
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    </AppLayout>
  );
}
