import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, User, Save, X, Upload } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, getDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const SEXO_OPTIONS = ['Masculino', 'Feminino', 'Outro'];
const RACA_COR_OPTIONS = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada'];
const MOVIMENTACAO_OPTIONS = ['Matrícula', 'Transferência Entrada', 'Transferência Saída', 'Remanejamento', 'Reclassificação'];
const STATUS_OPTIONS = ['Frequentando', 'Transferido', 'Desistente', 'Concluído'];
const VACINACAO_OPTIONS = ['Não', '1ª Dose', '2ª Dose', '3ª Dose', '4ª Dose', '5ª Dose'];

interface Turma {
  id: string;
  nome: string;
  serie: string;
}

export default function NovoAluno() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [formData, setFormData] = useState({
    // Status e Informações Básicas
    status: 'Frequentando',
    matricula: '',
    nome: '',
    foto_url: '',
    // Informações Pessoais
    sexo: '',
    raca_cor: '',
    // Movimentação
    tipo_movimentacao: '',
    data_movimentacao: '',
    de_onde_veio: '',
    para_onde_vai: '',
    // Documentos e Dados Pessoais
    data_nascimento: '',
    nacionalidade: 'Brasileira',
    naturalidade: '',
    uf: '',
    rg: '',
    cpf: '',
    // Programas Sociais
    bolsa_familia: false,
    // Censo e SUS
    censo_escola: false,
    id_censo: '',
    cartao_sus: '',
    vacinado_covid: 'Não',
    // Saúde
    aluno_pcd: false,
    aluno_aee: false,
    dieta_restritiva: false,
    // Informações Escolares
    largura_farda: '',
    altura_farda: '',
    pasta: '',
    prateleira: '',
    transporte_escolar: false,
    // Informações da Mãe
    mae_nome: '',
    mae_email: '',
    mae_contato: '',
    mae_rg: '',
    mae_cpf: '',
    // Informações do Pai
    pai_nome: '',
    pai_email: '',
    pai_contato: '',
    pai_rg: '',
    pai_cpf: '',
    // Endereço
    endereco: '',
    endereco_numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    // Outros
    ano: new Date().getFullYear(),
    turma_id: null as string | null,
  });

  useEffect(() => {
    fetchTurmas();
  }, []);

  useEffect(() => {
    if (isEditing && id) {
      fetchAluno(id);
    }
  }, [id, isEditing]);

  async function fetchTurmas() {
    try {
        const querySnapshot = await getDocs(collection(db, 'turmas'));
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
        setTurmas(turmasData.sort((a,b) => a.nome.localeCompare(b.nome)));
    } catch(error) {
        console.error("Error fetching turmas: ", error)
    }
  }

  async function fetchAluno(alunoId: string) {
    try {
      setLoading(true);
      const alunoDoc = await getDoc(doc(db, 'alunos', alunoId));
      if (alunoDoc.exists()) {
        const alunoData = alunoDoc.data();
        // Merge com os valores padrão para garantir que todos os campos existam
        setFormData(prev => ({
          ...prev,
          ...alunoData
        }));
      } else {
        toast.error('Aluno não encontrado');
        navigate('/alunos');
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do aluno');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `aluno-${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `alunos/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, foto_url: photoURL }));
      toast.success('Foto carregada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
      console.error(error)
    } finally {
      setUploading(false);
    }
  }

  const handleChange = (field: string, value: string | boolean | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const calculateCensusAge = (birthDate: string) => {
    if (!birthDate) return '';
    const censusDate = new Date(new Date().getFullYear(), 2, 31); // 31 de março
    const birth = new Date(birthDate);
    let age = censusDate.getFullYear() - birth.getFullYear();
    const monthDiff = censusDate.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && censusDate.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const finalFormData = {
      ...formData,
      nome_lower: formData.nome.toLowerCase()
    };

    try {
      if (isEditing && id) {
        await updateDoc(doc(db, 'alunos', id), finalFormData);
        toast.success('Aluno atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'alunos'), finalFormData);
        toast.success('Aluno cadastrado com sucesso!');
      }
      navigate('/alunos');
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            toast.error('Permissão negada. Verifique as regras de segurança do Firestore.');
        } else if (error.message.includes('matricula')) { // Simple check for a unique constraint violation
            toast.error('Matrícula já cadastrada');
        } else {
            toast.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} aluno`);
        }
        console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title={isEditing ? "Editar Aluno" : "Novo Aluno"}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              {isEditing ? "Edite as informações do aluno" : "Cadastre um novo aluno no sistema"}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/alunos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Lista de Alunos
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{isEditing ? "Editar Aluno" : "Novo Aluno"}</CardTitle>
              <span className="rounded-full px-3 py-1 text-sm font-medium bg-success/10 text-success">
                {formData.status}
              </span>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Foto do Aluno */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Foto do Aluno</h3>
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-4 overflow-hidden">
                    {formData.foto_url ? (
                      <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    type="button" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Carregando...' : 'Carregar Foto'}
                  </Button>
                </div>
              </div>

              {/* Status e Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Status e Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Status do Aluno</Label>
                    <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input placeholder="Número da matrícula" value={formData.matricula} onChange={(e) => handleChange('matricula', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input placeholder="Nome do aluno" value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Turma</Label>
                    <Select value={formData.turma_id || ''} onValueChange={(v) => handleChange('turma_id', v || null)}>
                      <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                      <SelectContent>
                        {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} - {t.serie}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Informações Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SEXO_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Raça/Cor/Etnia</Label>
                    <Select value={formData.raca_cor} onValueChange={(v) => handleChange('raca_cor', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {RACA_COR_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Movimentação */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Movimentação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Movimentação</Label>
                    <Select value={formData.tipo_movimentacao} onValueChange={(v) => handleChange('tipo_movimentacao', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {MOVIMENTACAO_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data da Movimentação</Label>
                    <Input type="date" value={formData.data_movimentacao} onChange={(e) => handleChange('data_movimentacao', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>De onde veio</Label>
                    <Input placeholder="Escola, Município, ..." value={formData.de_onde_veio} onChange={(e) => handleChange('de_onde_veio', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Para onde vai</Label>
                    <Input placeholder="Escola, Município, ..." value={formData.para_onde_vai} onChange={(e) => handleChange('para_onde_vai', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Documentos e Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Documentos e Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Atual</Label>
                    <Input value={calculateAge(formData.data_nascimento)} placeholder="Idade" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Censo (31/03)</Label>
                    <Input value={calculateCensusAge(formData.data_nascimento)} placeholder="Idade para o censo" disabled />
                    <p className="text-xs text-muted-foreground">Idade calculada até 31 de março do ano vigente</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nacionalidade</Label>
                    <Input value={formData.nacionalidade} onChange={(e) => handleChange('nacionalidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Naturalidade</Label>
                    <Input placeholder="Cidade de nascimento" value={formData.naturalidade} onChange={(e) => handleChange('naturalidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select value={formData.uf} onValueChange={(v) => handleChange('uf', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG do aluno" value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input placeholder="CPF do aluno" value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Programas Sociais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Programas Sociais</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <Label htmlFor="bolsa_familia">Recebe Bolsa Família?</Label>
                  <Switch id="bolsa_familia" checked={formData.bolsa_familia} onCheckedChange={(v) => handleChange('bolsa_familia', v)} />
                </div>
              </div>

              {/* Censo e SUS */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Censo e SUS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <Label htmlFor="censo_escola">Está no Censo da Escola?</Label>
                    <Switch id="censo_escola" checked={formData.censo_escola} onCheckedChange={(v) => handleChange('censo_escola', v)} />
                  </div>
                  {formData.censo_escola && (
                    <div className="space-y-2">
                      <Label>ID Censo</Label>
                      <Input placeholder="ID do Censo Escolar" value={formData.id_censo} onChange={(e) => handleChange('id_censo', e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Número Cartão SUS</Label>
                    <Input placeholder="Número do Cartão SUS" value={formData.cartao_sus} onChange={(e) => handleChange('cartao_sus', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vacinado COVID?</Label>
                  <Select value={formData.vacinado_covid} onValueChange={(v) => handleChange('vacinado_covid', v)}>
                    <SelectTrigger className="md:w-1/2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VACINACAO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Saúde */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Saúde</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="aluno_pcd">Aluno PCD?</Label>
                      <p className="text-xs text-muted-foreground">Pessoa com Deficiência</p>
                    </div>
                    <Switch id="aluno_pcd" checked={formData.aluno_pcd} onCheckedChange={(v) => handleChange('aluno_pcd', v)} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="aluno_aee">Aluno AEE?</Label>
                      <p className="text-xs text-muted-foreground">Atendimento Educacional Especializado</p>
                    </div>
                    <Switch id="aluno_aee" checked={formData.aluno_aee} onCheckedChange={(v) => handleChange('aluno_aee', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg md:w-1/2">
                  <Label htmlFor="dieta_restritiva">O aluno tem dieta restritiva?</Label>
                  <Switch id="dieta_restritiva" checked={formData.dieta_restritiva} onCheckedChange={(v) => handleChange('dieta_restritiva', v)} />
                </div>
              </div>

              {/* Informações Escolares */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações Escolares</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Largura da Farda</Label>
                    <Input placeholder="Largura em cm" value={formData.largura_farda} onChange={(e) => handleChange('largura_farda', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura da Farda</Label>
                    <Input placeholder="Altura em cm" value={formData.altura_farda} onChange={(e) => handleChange('altura_farda', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pasta</Label>
                    <Input placeholder="Número da pasta" value={formData.pasta} onChange={(e) => handleChange('pasta', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Localização da pasta física do aluno</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prateleira</Label>
                    <Input placeholder="Localização da prateleira" value={formData.prateleira} onChange={(e) => handleChange('prateleira', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Prateleira onde está arquivada a pasta</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg md:w-1/2">
                  <Label htmlFor="transporte_escolar">Transporte Escolar?</Label>
                  <Switch id="transporte_escolar" checked={formData.transporte_escolar} onCheckedChange={(v) => handleChange('transporte_escolar', v)} />
                </div>
              </div>

              {/* Informações da Mãe */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações da Mãe</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Mãe</Label>
                    <Input placeholder="Nome completo da mãe" value={formData.mae_nome} onChange={(e) => handleChange('mae_nome', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email da mãe" value={formData.mae_email} onChange={(e) => handleChange('mae_email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone da mãe" value={formData.mae_contato} onChange={(e) => handleChange('mae_contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG da mãe" value={formData.mae_rg} onChange={(e) => handleChange('mae_rg', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CPF</Label>
                  <Input placeholder="CPF da mãe" value={formData.mae_cpf} onChange={(e) => handleChange('mae_cpf', e.target.value)} />
                </div>
              </div>

              {/* Informações do Pai */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações do Pai</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Pai</Label>
                    <Input placeholder="Nome completo do pai" value={formData.pai_nome} onChange={(e) => handleChange('pai_nome', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email do pai" value={formData.pai_email} onChange={(e) => handleChange('pai_email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone do pai" value={formData.pai_contato} onChange={(e) => handleChange('pai_contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG do pai" value={formData.pai_rg} onChange={(e) => handleChange('pai_rg', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CPF</Label>
                  <Input placeholder="CPF do pai" value={formData.pai_cpf} onChange={(e) => handleChange('pai_cpf', e.target.value)} />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua, Avenida, etc." value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº</Label>
                    <Input placeholder="Número" value={formData.endereco_numero} onChange={(e) => handleChange('endereco_numero', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input placeholder="Bairro" value={formData.bairro} onChange={(e) => handleChange('bairro', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input placeholder="Cidade" value={formData.cidade} onChange={(e) => handleChange('cidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.estado} onValueChange={(v) => handleChange('estado', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CEP</Label>
                  <Input placeholder="CEP" value={formData.cep} onChange={(e) => handleChange('cep', e.target.value)} />
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/alunos')}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? (isEditing ? 'Atualizando...' : 'Salvando...') : (isEditing ? 'Atualizar' : 'Salvar')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}