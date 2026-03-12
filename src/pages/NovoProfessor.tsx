import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Plus, Trash2, Upload, FileText, X, Camera } from 'lucide-react';
import { WebcamCapture } from '@/components/ui/webcam-capture';
import { db, storage, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, addDoc, updateDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { generateMatricula } from '@/lib/matriculaUtils';

interface Formacao {
  id: string;
  curso: string;
  nivel: string;
  ano_conclusao: string;
}

const componentes = [
  'Língua Portuguesa',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Arte',
  'Educação Física',
  'Inglês',
  'Ensino Religioso',
  'Física',
  'Química',
  'Biologia',
  'Filosofia',
  'Sociologia',
];

const SERIES = [
  'Ensino Fundamental I (1º ao 5º)',
  'Ensino Fundamental II (6º ao 9º)',
  'Ensino Médio',
  'EJA - Educação de Jovens e Adultos'
];

export default function NovoProfessor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { escolaAtivaId } = useUserRole();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    foto_url: '',
    nome: '',
    matricula: '',
    rg: '',
    cpf: '',
    email: '',
    contato: '',
    status_funcional: 'Lotado',
    data_lotacao: '',
    arquivo_url: '',
    link_lattes: '',
    biografia: '',
    componentes: [] as string[],
    series: [] as string[],
    ativo: true,
    componente: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cep: '',
    usuario_id: '',
  });

  const [formacoes, setFormacoes] = useState<Formacao[]>([
    { id: '1', curso: '', nivel: '', ano_conclusao: '' }
  ]);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }

    setUploadingPdf(true);
    try {
      const fileName = `professor_${Date.now()}.pdf`;
      const storageRef = ref(storage, `professores/documentos/${fileName}`);

      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, arquivo_url: fileURL }));
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      toast.error('Sem permissão para enviar arquivo');
      console.error(error);
    } finally {
      setUploadingPdf(false);
    }
  }

  function removePdf() {
    setFormData(prev => ({ ...prev, arquivo_url: '' }));
  }

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `professor_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `professores/fotos/${fileName}`);

      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, foto_url: photoURL }));
      toast.success('Foto carregada com sucesso!');
    } catch (error) {
      toast.error('Sem permissão para fazer upload da foto');
      console.error(error);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    await uploadPhoto(file);
  }

  useEffect(() => {
    if (isEditing) {
      loadProfessor();
    }
  }, [id]);

  async function loadProfessor() {
    if (!id) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'professores', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          foto_url: data.foto_url || '',
          nome: data.nome,
          matricula: data.matricula,
          rg: data.rg || '',
          cpf: data.cpf || '',
          email: data.email,
          contato: data.contato || '',
          status_funcional: data.status_funcional || 'Lotado',
          data_lotacao: data.data_lotacao || '',
          arquivo_url: data.arquivo_url || '',
          link_lattes: data.link_lattes || '',
          biografia: data.biografia || '',
          componentes: data.componentes || [],
          series: data.series || [],
          ativo: data.ativo ?? true,
          componente: data.componente,
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          cep: data.cep || '',
          usuario_id: data.usuario_id || '',
        });
        if (data.formacoes && Array.isArray(data.formacoes)) {
          setFormacoes(data.formacoes as Formacao[]);
        }
      } else {
        toast.error('Professor não encontrado');
        navigate('/professores');
      }
    } catch (error) {
      toast.error('Sem permissão para carregar professor');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function addFormacao() {
    setFormacoes([...formacoes, { id: Date.now().toString(), curso: '', nivel: '', ano_conclusao: '' }]);
  }

  function removeFormacao(id: string) {
    if (formacoes.length > 1) {
      setFormacoes(formacoes.filter(f => f.id !== id));
    }
  }

  function updateFormacao(id: string, field: keyof Formacao, value: string) {
    setFormacoes(formacoes.map(f => f.id === id ? { ...f, [field]: value } : f));
  }

  function toggleDisciplina(disc: string) {
    setFormData(prev => ({
      ...prev,
      componentes: prev.componentes.includes(disc)
        ? prev.componentes.filter(d => d !== disc)
        : [...prev.componentes, disc]
    }));
  }

  function toggleSerie(serie: string) {
    setFormData(prev => ({
      ...prev,
      series: prev.series.includes(serie)
        ? prev.series.filter(s => s !== serie)
        : [...prev.series, serie]
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      nome_lower: formData.nome.toLowerCase(),
      formacoes: formacoes.filter(f => f.curso),
      componente: formData.componentes[0] || formData.componente || 'Geral',
      escola_id: escolaAtivaId,
    };

    try {
      if (!escolaAtivaId) {
        toast.error('Nenhuma escola selecionada. Operação cancelada.');
        setLoading(false);
        return;
      }

      if (isEditing) {
        if (!id) return;
        const docRef = doc(db, 'professores', id);
        await updateDoc(docRef, payload);

        // Sincronizar nome no perfil de usuário se houver um vínculo
        const userId = (payload as any).usuario_id;
        if (userId) {
          try {
            await updateDoc(doc(db, 'profiles', userId), { nome: payload.nome });
          } catch (err) {
            console.warn('Sem permissão para sincronizar nome no perfil:', err);
          }
        } else if (payload.email) {
          try {
            const profilesSnap = await getDocs(
              query(collection(db, 'profiles'), where('email', '==', payload.email.toLowerCase()))
            );
            if (!profilesSnap.empty) {
              await updateDoc(doc(db, 'profiles', profilesSnap.docs[0].id), { nome: payload.nome });
            }
          } catch (err) {
            console.warn('Sem permissão para sincronizar nome no perfil por e-mail:', err);
          }
        }

        await logActivity(`atualizou o cadastro do professor(a) "${formData.nome}".`);
        toast.success('Professor atualizado com sucesso!');
      } else {
        // BLINDAGEM: Usa Cloud Function para criar conta + papel + perfil de forma segura
        const createUser = httpsCallable(functions, 'createUserAccount');
        const result = await createUser({
          email: formData.email,
          password: 'DIARIODIGITAL2026', // Senha padrão inicial
          nome: formData.nome,
          role: 'professor', // Papel fixo para esta página
          escola_id: escolaAtivaId
        });

        const { uid } = result.data as { uid: string };

        // Gera matrícula automática no padrão PROF
        const novaMatricula = await generateMatricula('PROF', 'professores');

        // Cria o documento na coleção professores vinculado ao UID criado
        await setDoc(doc(db, 'professores', uid), {
          ...payload,
          matricula: novaMatricula,
          usuario_id: uid
        });

        await logActivity(`cadastrou o novo professor(a) "${formData.nome}".`);
        toast.success('Professor cadastrado com sucesso! O acesso já está liberado.');
      }
      navigate('/professores');
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada. Verifique as regras de segurança do Firestore.');
      } else if (error.message.includes('matricula') || error.message.includes('email')) {
        toast.error('Matrícula ou email já cadastrados');
      } else {
        toast.error('Sem permissão para salvar professor');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title={isEditing ? "Editar Professor" : "Novo Professor"}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">Gerencie o corpo docente da instituição</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/professores')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Lista de Professores
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{isEditing ? 'Editar Professor' : 'Novo Professor'}</CardTitle>
              <span className="rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary">
                {formData.status_funcional}
              </span>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Foto do Perfil */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Foto do Perfil</h3>
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-4 overflow-hidden">
                    {formData.foto_url ? (
                      <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingPhoto ? 'Carregando...' : 'Carregar Foto'}
                    </Button>

                    <WebcamCapture
                      onCapture={uploadPhoto}
                      trigger={
                        <Button variant="outline" size="sm" type="button" disabled={uploadingPhoto}>
                          <Camera className="h-4 w-4 mr-2" />
                          Tirar Foto
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo*</Label>
                    <Input
                      id="nome"
                      placeholder="Nome completo"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="matricula">Matrícula</Label>
                    <Input
                      id="matricula"
                      placeholder="Gerado automaticamente"
                      value={formData.matricula}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rg">RG</Label>
                    <Input
                      id="rg"
                      placeholder="Número do RG"
                      value={formData.rg}
                      onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      placeholder="Número do CPF"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail*</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="E-mail institucional"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contato">Contato</Label>
                    <Input
                      id="contato"
                      placeholder="Número de contato"
                      value={formData.contato}
                      onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      placeholder="Rua, Avenida, etc."
                      value={formData.logradouro}
                      onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      placeholder="Número"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      placeholder="Bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-4 lg:col-span-1">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      placeholder="CEP"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Situação Funcional */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Situação Funcional</h3>
                <div className="space-y-2">
                  <Label>Status*</Label>
                  <RadioGroup
                    value={formData.status_funcional}
                    onValueChange={(value) => setFormData({ ...formData, status_funcional: value })}
                    className="flex flex-wrap gap-4"
                  >
                    {['Lotado', 'Afastado', 'Aposentado', 'Transferido'].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <RadioGroupItem value={status} id={`status-${status}`} />
                        <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_lotacao">Data de Lotação na Escola</Label>
                    <Input
                      id="data_lotacao"
                      type="date"
                      value={formData.data_lotacao}
                      onChange={(e) => setFormData({ ...formData, data_lotacao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Upload de Memorando/Ofício (PDF)</Label>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePdfUpload}
                    />
                    {formData.arquivo_url ? (
                      <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                        <FileText className="h-5 w-5 text-primary" />
                        <a
                          href={formData.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex-1 truncate"
                        >
                          Documento anexado
                        </a>
                        <Button type="button" variant="ghost" size="icon" onClick={removePdf}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={uploadingPdf}
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingPdf ? 'Enviando...' : 'Escolher Arquivo'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações Profissionais */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Formação Acadêmica</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addFormacao} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Adicionar Formação
                  </Button>
                </div>

                {formacoes.map((formacao, index) => (
                  <div key={formacao.id} className="space-y-4 p-4 border rounded-lg relative">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Formação {index + 1}</span>
                      {formacoes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFormacao(formacao.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Formação</Label>
                        <Input
                          placeholder="Nome do curso"
                          value={formacao.curso}
                          onChange={(e) => updateFormacao(formacao.id, 'curso', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nível</Label>
                        <Select
                          value={formacao.nivel}
                          onValueChange={(value) => updateFormacao(formacao.id, 'nivel', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o nível" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Graduação">Graduação</SelectItem>
                            <SelectItem value="Especialização">Especialização</SelectItem>
                            <SelectItem value="Mestrado">Mestrado</SelectItem>
                            <SelectItem value="Doutorado">Doutorado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ano de Conclusão</Label>
                        <Select
                          value={formacao.ano_conclusao}
                          onValueChange={(value) => updateFormacao(formacao.id, 'ano_conclusao', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ano" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map((ano) => (
                              <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="link_lattes">Link do Lattes</Label>
                  <Input
                    id="link_lattes"
                    placeholder="http://lattes.cnpq.br/..."
                    value={formData.link_lattes}
                    onChange={(e) => setFormData({ ...formData, link_lattes: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="biografia">Biografia</Label>
                  <Textarea
                    id="biografia"
                    placeholder="Breve biografia profissional"
                    rows={4}
                    value={formData.biografia}
                    onChange={(e) => setFormData({ ...formData, biografia: e.target.value })}
                  />
                </div>
              </div>

              {/* componentes */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">componentes</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {componentes.map((disc) => (
                    <div key={disc} className="flex items-center space-x-2">
                      <Checkbox
                        id={`disc-${disc}`}
                        checked={formData.componentes.includes(disc)}
                        onCheckedChange={() => toggleDisciplina(disc)}
                      />
                      <Label htmlFor={`disc-${disc}`} className="font-normal">{disc}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Séries */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Séries</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SERIES.map((serie) => (
                    <div key={serie} className="flex items-center space-x-2">
                      <Checkbox
                        id={`serie-${serie}`}
                        checked={formData.series.includes(serie)}
                        onCheckedChange={() => toggleSerie(serie)}
                      />
                      <Label htmlFor={`serie-${serie}`} className="font-normal">{serie}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/professores')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
