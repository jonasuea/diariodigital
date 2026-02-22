import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { School, Mail, Phone, MapPin, Clock, Bell, Shield, Wrench, User, Building, Loader2, Upload, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { db, storage } from '@/lib/firebase';
import { logActivity } from '@/lib/logger';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Configuracoes() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isInstalacoesOpen, setIsInstalacoesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [escolaConfig, setEscolaConfig] = useState({
    nome: 'Escola Municipal Nome da Escola',
    email: 'contato@escolanome.edu.br',
    telefone: '(11) 3456-7890',
    endereco: 'Rua das Flores, 123 - São Paulo',
    horarioFuncionamento: 'Segunda a Sexta, 7h às 18h',
  });

  const [instalacoes, setInstalacoes] = useState({
    salasAula: 12,
    laboratorios: 3,
    banheiros: 6,
    cantina: 1,
    biblioteca: 1,
    quadras: 2,
    secretaria: 1,
    salaProfessores: 1,
  });

  const [preferencias, setPreferencias] = useState({
    notificacoes: true,
    autenticacaoDoisFatores: false,
    modoManutencao: false,
    telaCheiaPadrao: false,
  });

  const [profileData, setProfileData] = useState({
    nome: 'Administrador',
    email: user?.email || 'admin@escola.edu.br',
    telefone: '(11) 98765-4321',
    cargo: 'Administrador',
    foto_url: '',
    novaSenha: '',
    confirmarSenha: '',
  });

  useEffect(() => {
    // Lógica para entrar ou sair do modo de tela cheia
    const toggleFullScreen = async () => {
      if (preferencias.telaCheiaPadrao) {
        if (document.fullscreenElement === null) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (err) {
            console.error(`Erro ao tentar ativar a tela cheia: ${err.message}`);
          }
        }
      } else {
        if (document.fullscreenElement !== null) {
          try {
            await document.exitFullscreen();
          } catch (err) {
            console.error(`Erro ao tentar desativar a tela cheia: ${err.message}`);
          }
        }
      }
    };
    toggleFullScreen();
  }, [preferencias.telaCheiaPadrao]);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        // Carregar configurações da escola
        const configDocRef = doc(db, 'configuracoes', 'escola');
        const configDocSnap = await getDoc(configDocRef);

        if (configDocSnap.exists()) {
          const data = configDocSnap.data();
          if (data.escolaConfig) setEscolaConfig(data.escolaConfig);
          if (data.instalacoes) setInstalacoes(data.instalacoes);
          if (data.preferencias) {
            setPreferencias(data.preferencias);
            // Sincronizar com o localStorage ao carregar
            localStorage.setItem('telaCheiaPadrao', JSON.stringify(data.preferencias.telaCheiaPadrao || false));
          }
        }

        // Carregar perfil do usuário
        if (user) {
          const profileDocRef = doc(db, 'profiles', user.uid);
          const profileDocSnap = await getDoc(profileDocRef);
          if (profileDocSnap.exists()) {
            const profile = profileDocSnap.data();
            setProfileData(prev => ({
              ...prev,
              nome: profile.nome || prev.nome,
              email: user.email || prev.email,
              telefone: profile.telefone || '',
              cargo: profile.cargo || role || prev.cargo,
              foto_url: profile.foto_url || '',
            }));
          }
        }
      } catch (error) {
        toast.error('Erro ao carregar configurações');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [user, role]);

  const handleSaveEscola = async () => {
    try {
      const docRef = doc(db, 'configuracoes', 'escola');
      await setDoc(docRef, { escolaConfig }, { merge: true });
      await logActivity('atualizou as informações da escola.');
      toast.success('Informações da escola salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar informações da escola');
      console.error(error);
    }
  };

  const handleSaveInstalacoes = async () => {
    try {
      const docRef = doc(db, 'configuracoes', 'escola');
      await setDoc(docRef, { instalacoes }, { merge: true });
      await logActivity('atualizou as informações das instalações da escola.');
      toast.success('Instalações atualizadas com sucesso!');
      setIsInstalacoesOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar instalações');
      console.error(error);
    }
  };
  
  const handleSavePreferencias = async (newPreferencias: typeof preferencias) => {
    setPreferencias(newPreferencias);
    // Salvar no localStorage para persistência imediata no navegador
    localStorage.setItem('telaCheiaPadrao', JSON.stringify(newPreferencias.telaCheiaPadrao));
    try {
      const docRef = doc(db, 'configuracoes', 'escola');
      await setDoc(docRef, { preferencias: newPreferencias }, { merge: true });
      await logActivity('atualizou as preferências do sistema.');
      toast.success('Preferências salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar preferências');
      console.error(error);
    }
  };

  const handleSaveProfile = async () => {
    if (profileData.novaSenha && profileData.novaSenha !== profileData.confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }

    try {
      // TODO: Implementar atualização de senha usando a função do AuthContext
      // if (profileData.novaSenha) { ... }

      const profileDocRef = doc(db, 'profiles', user.uid);
      const dataToUpdate = {
        nome: profileData.nome,
        telefone: profileData.telefone,
        cargo: profileData.cargo,
      };
      await setDoc(profileDocRef, dataToUpdate, { merge: true });

      await logActivity('atualizou as informações do seu perfil.');
      toast.success('Perfil atualizado com sucesso!');
      setIsEditProfileOpen(false);
      setProfileData(prev => ({ ...prev, novaSenha: '', confirmarSenha: '' }));
    } catch (error) {
      toast.error('Erro ao atualizar o perfil.');
      console.error(error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `user_${user?.uid}_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `usuarios/fotos/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Atualiza o estado local e salva a URL no Firestore
      setProfileData(prev => ({ ...prev, foto_url: photoURL }));
      const profileDocRef = doc(db, 'profiles', user.uid);
      await setDoc(profileDocRef, { foto_url: photoURL }, { merge: true });

      await logActivity('atualizou sua foto de perfil.');
      toast.success('Foto de perfil atualizada!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
      console.error(error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSyncSearchData = async () => {
    setIsSyncing(true);
    toast.info('Iniciando a sincronização dos dados de busca. Isso pode levar alguns minutos...');

    try {
      const collectionsToSync = ['estudantes', 'professores', 'equipe-gestora'];
      let updatedCount = 0;

      for (const collectionName of collectionsToSync) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        let batchWrites = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.nome && !data.nome_lower) {
            batch.update(doc.ref, { nome_lower: data.nome.toLowerCase() });
            batchWrites++;
            updatedCount++;
          }
          // Firestore batches can have up to 500 operations.
          if (batchWrites >= 499) {
            batch.commit();
            // batch = writeBatch(db); // This line is incorrect, reinitialization should be done after commit.
            batchWrites = 0;
          }
        });
        
        if (batchWrites > 0) {
          await batch.commit();
        }
      }

      if (updatedCount > 0) {
        toast.success(`${updatedCount} registros foram atualizados com sucesso!`);
      } else {
        toast.success('Todos os registros já estão sincronizados.');
      }

    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
      toast.error('Ocorreu um erro durante a sincronização.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    toast.info('Iniciando a migração de dados de "estudantes" para "estudantes". Não feche esta página.');

    try {
      const estudantesRef = collection(db, 'estudantes');
      const estudantesSnapshot = await getDocs(estudantesRef);

      if (estudantesSnapshot.empty) {
        toast.info('A coleção "estudantes" já está vazia. Nenhuma migração é necessária.');
        return;
      }

      const batch = writeBatch(db);
      let count = 0;

      estudantesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const newDocRef = doc(db, 'estudantes', docSnapshot.id);
        batch.set(newDocRef, data);
        count++;
      });

      await batch.commit();
      toast.success(`${count} registros de estudantes foram migrados com sucesso!`);
      toast.warning('Atenção: A coleção antiga "estudantes" não foi excluída. Por favor, verifique os dados e, se tudo estiver correto, apague-a manualmente no console do Firebase.');

    } catch (error) {
      console.error("Erro ao migrar dados:", error);
      toast.error('Ocorreu um erro durante a migração. Verifique o console para mais detalhes.');
    } finally {
      setIsMigrating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Configurações">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie as configurações do sistema</p>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Informações da Escola</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome da Escola</Label>
                    <div className="flex items-center gap-2">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.nome}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, nome: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.email}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, email: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.telefone}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, telefone: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.endereco}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, endereco: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Horário de Funcionamento</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={escolaConfig.horarioFuncionamento}
                      onChange={(e) => setEscolaConfig({ ...escolaConfig, horarioFuncionamento: e.target.value })}
                      className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveEscola} className="mt-2">
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>

            {/* Instalações da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Instalações da Escola</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsInstalacoesOpen(true)}>
                    <Building className="h-4 w-4 mr-2" />
                    Gerenciar Instalações
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Salas de Aula</p>
                      <p className="text-2xl font-bold">{instalacoes.salasAula}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Laboratórios</p>
                      <p className="text-2xl font-bold">{instalacoes.laboratorios}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Banheiros</p>
                      <p className="text-2xl font-bold">{instalacoes.banheiros}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Cantina</p>
                      <p className="text-2xl font-bold">{instalacoes.cantina}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Biblioteca</p>
                      <p className="text-2xl font-bold">{instalacoes.biblioteca}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Quadras</p>
                      <p className="text-2xl font-bold">{instalacoes.quadras}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Preferências do Sistema */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Preferências do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Notificações</p>
                      <p className="text-sm text-muted-foreground">
                        Receber notificações de eventos e atividades
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.notificacoes}
                    onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, notificacoes: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Autenticação em Dois Fatores</p>
                      <p className="text-sm text-muted-foreground">
                        Aumenta a segurança da sua conta
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.autenticacaoDoisFatores}
                    onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, autenticacaoDoisFatores: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Navegador em Tela Cheia</p>
                      <p className="text-sm text-muted-foreground">
                        O sistema sempre iniciará em modo de tela cheia
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.telaCheiaPadrao}
                    onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, telaCheiaPadrao: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar direita */}
          <div className="space-y-6">

            {/* Informações da Conta */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Informações da Conta</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                <div className="relative group mb-4">
                  <Avatar className="h-24 w-24 border-2 border-primary/20">
                    <AvatarImage src={profileData.foto_url} alt={profileData.nome} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                      {profileData.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button 
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                {uploadingPhoto && <p className="text-xs text-muted-foreground mb-2 animate-pulse">Enviando foto...</p>}
                <h3 className="font-semibold text-lg">{profileData.nome}</h3>
                <p className="text-sm text-muted-foreground mb-4">{profileData.email}</p>
                <Button variant="outline" className="w-full" onClick={() => setIsEditProfileOpen(true)}>
                  Editar Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Versão do Sistema */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Versão do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Versão Atual</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última Atualização</span>
                  <span className="font-medium">30/06/2023</span>
                </div>
                <Button variant="outline" className="w-full mt-2">
                  Verificar Atualizações
                </Button>
              </CardContent>
            </Card>

            {/* Manutenção do Sistema */}
            {role === 'admin' && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">Manutenção do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Modo de Manutenção</p>
                          <p className="text-sm text-muted-foreground">
                            Sistema disponível apenas para administradores
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={preferencias.modoManutencao}
                        onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, modoManutencao: checked })}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2 mt-4">
                        Se a busca por nome não encontrar registros antigos, clique no botão abaixo para sincronizar os dados.
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={handleSyncSearchData} 
                        disabled={isSyncing || isMigrating}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-2" />
                        )}
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Dados de Busca'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Dialog Editar Perfil */}
        <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Perfil</DialogTitle>
              <DialogDescription>
                Atualize suas informações pessoais abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-nome">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-nome"
                    className="pl-10"
                    value={profileData.nome}
                    onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    className="pl-10"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-telefone"
                    className="pl-10"
                    value={profileData.telefone}
                    onChange={(e) => setProfileData({ ...profileData, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-cargo">Cargo</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-cargo"
                    className="pl-10"
                    value={profileData.cargo}
                    onChange={(e) => setProfileData({ ...profileData, cargo: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-senha">Nova Senha</Label>
                <Input
                  id="profile-senha"
                  type="password"
                  placeholder="Deixe em branco para não alterar"
                  value={profileData.novaSenha}
                  onChange={(e) => setProfileData({ ...profileData, novaSenha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirmar-senha">Confirmar Nova Senha</Label>
                <Input
                  id="profile-confirmar-senha"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={profileData.confirmarSenha}
                  onChange={(e) => setProfileData({ ...profileData, confirmarSenha: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProfile}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Gerenciar Instalações */}
        <Dialog open={isInstalacoesOpen} onOpenChange={setIsInstalacoesOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar Instalações da Escola</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salasAula">Salas de Aula</Label>
                <Input
                  id="salasAula"
                  type="number"
                  value={instalacoes.salasAula}
                  onChange={(e) => setInstalacoes({ ...instalacoes, salasAula: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laboratorios">Laboratórios</Label>
                <Input
                  id="laboratorios"
                  type="number"
                  value={instalacoes.laboratorios}
                  onChange={(e) => setInstalacoes({ ...instalacoes, laboratorios: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banheiros">Banheiros</Label>
                <Input
                  id="banheiros"
                  type="number"
                  value={instalacoes.banheiros}
                  onChange={(e) => setInstalacoes({ ...instalacoes, banheiros: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantina">Cantina</Label>
                <Input
                  id="cantina"
                  type="number"
                  value={instalacoes.cantina}
                  onChange={(e) => setInstalacoes({ ...instalacoes, cantina: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biblioteca">Biblioteca</Label>
                <Input
                  id="biblioteca"
                  type="number"
                  value={instalacoes.biblioteca}
                  onChange={(e) => setInstalacoes({ ...instalacoes, biblioteca: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quadras">Quadras</Label>
                <Input
                  id="quadras"
                  type="number"
                  value={instalacoes.quadras}
                  onChange={(e) => setInstalacoes({ ...instalacoes, quadras: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretaria">Secretaria</Label>
                <Input
                  id="secretaria"
                  type="number"
                  value={instalacoes.secretaria}
                  onChange={(e) => setInstalacoes({ ...instalacoes, secretaria: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaProfessores">Sala dos Professores</Label>
                <Input
                  id="salaProfessores"
                  type="number"
                  value={instalacoes.salaProfessores}
                  onChange={(e) => setInstalacoes({ ...instalacoes, salaProfessores: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsInstalacoesOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveInstalacoes}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
