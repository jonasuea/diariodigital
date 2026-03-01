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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Plus, Trash2, Upload, FileText, X } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { collection, doc, getDoc, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

interface Formacao {
  id: string;
  curso: string;
  nivel: string;
  ano_conclusao: string;
}

const CARGOS = ['Diretor', 'Vice-Diretor', 'Coordenador Pedagógico', 'Secretário', 'Orientador Educacional', 'Supervisor'];
const ROLES = ['gestor', 'pedagogo', 'secretario'];

export default function NovoMembro() {
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
    telefone: '',
    cargo: '',
    status: 'Lotado',
    data_lotacao: '',
    arquivo_url: '',
    biografia: '',
    link_lattes: '',
    role: 'gestor', // Adicionando o estado para o perfil de acesso
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
      const fileName = `membro_${Date.now()}.pdf`;
      const storageRef = ref(storage, `equipe_gestora/documentos/${fileName}`);

      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, arquivo_url: fileURL }));
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
      console.error(error);
    } finally {
      setUploadingPdf(false);
    }
  }

  function removePdf() {
    setFormData(prev => ({ ...prev, arquivo_url: '' }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `membro_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `equipe_gestora/fotos/${fileName}`);

      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, foto_url: photoURL }));
      toast.success('Foto carregada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
      console.error(error);
    } finally {
      setUploadingPhoto(false);
    }
  }

  useEffect(() => {
    if (isEditing) {
      loadMembro();
    }
  }, [id]);

  async function loadMembro() {
    if (!id) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'equipe_gestora', id);
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
          telefone: data.telefone || '',
          cargo: data.cargo,
          status: data.status || 'Lotado',
          data_lotacao: data.data_lotacao || '',
          arquivo_url: data.arquivo_url || '',
          biografia: data.biografia || '',
          link_lattes: data.link_lattes || '',
          role: data.role || 'gestor',
        });
        if (data.formacoes && Array.isArray(data.formacoes)) {
          setFormacoes(data.formacoes as Formacao[]);
        }
      } else {
        toast.error('Membro não encontrado');
        navigate('/equipe-gestora');
      }
    } catch (error) {
      toast.error('Erro ao carregar membro');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      nome_lower: formData.nome.toLowerCase(),
      formacoes: formacoes.filter(f => f.curso),
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
        const docRef = doc(db, 'equipe_gestora', id);
        await updateDoc(docRef, payload);

        // Atualiza o e-mail em user_roles se tiver mudado
        const userRoleRef = doc(db, 'user_roles', id);
        const userRoleSnap = await getDoc(userRoleRef);
        if (userRoleSnap.exists()) {
          const currentRole = userRoleSnap.data().role;
          const currentEmail = userRoleSnap.data().email;
          if (currentRole !== formData.role || currentEmail !== formData.email) {
            await updateDoc(userRoleRef, { role: formData.role, email: formData.email });
          }
        }

        await logActivity(`atualizou o cadastro do membro da equipe "${formData.nome}".`);
        toast.success('Membro atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'equipe_gestora'), payload);
        await setDoc(doc(db, 'user_roles', docRef.id), {
          email: formData.email,
          role: formData.role,
          status: 'pending',
          escola_id: escolaAtivaId,
        });
        await logActivity(`cadastrou o novo membro da equipe "${formData.nome}".`);
        toast.success('Membro cadastrado com sucesso! Acesse a página de "Usuários" para definir o acesso.');
      }
      navigate('/equipe-gestora');
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada. Verifique as regras de segurança do Firestore.');
      } else if (error.message.includes('matricula') || error.message.includes('email')) {
        toast.error('Matrícula ou email já cadastrados');
      } else {
        toast.error('Erro ao salvar membro');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title={isEditing ? "Editar Membro" : "Novo Membro"}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">Gerencie a equipe gestora da instituição</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/equipe-gestora')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Equipe Gestora
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{isEditing ? 'Editar Membro' : 'Novo Membro'}</CardTitle>
              <span className="rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary">
                {formData.status}
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
                </div>
              </div>

              {/* Informações Pessoais */}
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
                    <Label htmlFor="matricula">Matrícula*</Label>
                    <Input
                      id="matricula"
                      placeholder="Número de matrícula"
                      value={formData.matricula}
                      onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                      required
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
                    <Label htmlFor="email">Email*</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Email institucional"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="Número de telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo*</Label>
                  <Select value={formData.cargo} onValueChange={(value) => setFormData({ ...formData, cargo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGOS.map((cargo) => (
                        <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Perfil de Acesso*</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o perfil de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Situação Funcional */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Situação Funcional</h3>
                <div className="space-y-2">
                  <Label>Status*</Label>
                  <RadioGroup
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    className="flex flex-wrap gap-4"
                  >
                    {['Lotado', 'Temporário', 'Afastado', 'Aposentado', 'Transferido'].map((status) => (
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

              {/* Formação Acadêmica */}
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
                  <Label htmlFor="biografia">Biografia</Label>
                  <Textarea
                    id="biografia"
                    placeholder="Breve biografia profissional"
                    rows={4}
                    value={formData.biografia}
                    onChange={(e) => setFormData({ ...formData, biografia: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link_lattes">Currículo Lattes</Label>
                  <Input
                    id="link_lattes"
                    placeholder="Link para o currículo Lattes"
                    value={formData.link_lattes}
                    onChange={(e) => setFormData({ ...formData, link_lattes: e.target.value })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/equipe-gestora')}>
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
