import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { School, Mail, Phone, MapPin, Clock, Bell, Shield, Wrench, User, Building, Loader2, Upload, Camera, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { db, storage } from '@/lib/firebase';
import { logActivity } from '@/lib/logger';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Configuracoes() {
  const { user } = useAuth();
  const { role, escolaAtivaId } = useUserRole();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isInstalacoesOpen, setIsInstalacoesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const APP_VERSION = "0.0.4"; // VersÃ£o local atual do cÃ³digo

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [newVersionAvailable, setNewVersionAvailable] = useState<{ version: string, notes: string } | null>(null);

  const [escolaConfig, setEscolaConfig] = useState({
    inep: '',
    nome: 'Escola Municipal Nome da Escola',
    decretoCriacao: '',
    email: 'contato@escolanome.edu.br',
    telefone: '(11) 0000-0000',
    zona: '',
    endereco: 'Rua das Flores, 123 - SÃ£o Paulo',
    horarioFuncionamento: 'Segunda a Sexta, 7h Ã s 18h',
  });

  const [instalacoes, setInstalacoes] = useState({
    salasAula: 0,
    laboratorios: 0,
    banheiros: 0,
    cantina: 0,
    biblioteca: 0,
    quadras: 0,
    secretaria: 0,
    salaProfessores: 0,
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
    // LÃ³gica para entrar ou sair do modo de tela cheia
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
        // Carregar configuraÃ§Ãµes do sistema (preferÃªncias)
        const configDocRef = doc(db, 'configuracoes', 'escola');
        const configDocSnap = await getDoc(configDocRef);

        if (configDocSnap.exists()) {
          const data = configDocSnap.data();
          if (data.preferencias) {
            setPreferencias(data.preferencias);
            localStorage.setItem('telaCheiaPadrao', JSON.stringify(data.preferencias.telaCheiaPadrao || false));
          }
        }

        // Carregar dados reais da escola atual
        if (escolaAtivaId) {
          const escolaDocRef = doc(db, 'escolas', escolaAtivaId);
          const escolaSnap = await getDoc(escolaDocRef);
          if (escolaSnap.exists()) {
            const d = escolaSnap.data();
            setEscolaConfig(prev => ({
              ...prev,
              inep: d.inep || prev.inep,
              nome: d.nome || prev.nome,
              decretoCriacao: d.decreto_criacao || prev.decretoCriacao,
              email: d.email || prev.email,
              telefone: d.telefone || prev.telefone,
              zona: d.zona || prev.zona,
              endereco: d.endereco || prev.endereco,
              horarioFuncionamento: d.horario_funcionamento || prev.horarioFuncionamento,
            }));
            setInstalacoes(prev => ({
              ...prev,
              salasAula: parseInt(d.salas_aula) || prev.salasAula,
              laboratorios: parseInt(d.laboratorios) || prev.laboratorios,
              banheiros: parseInt(d.banheiros) || prev.banheiros,
              cantina: parseInt(d.cantina) || prev.cantina,
              biblioteca: parseInt(d.biblioteca) || prev.biblioteca,
              quadras: parseInt(d.quadras) || prev.quadras,
              secretaria: parseInt(d.secretaria) || prev.secretaria,
              salaProfessores: parseInt(d.salaProfessores) || prev.salaProfessores,
            }));
          }
        }

        // Carregar perfil do usuÃ¡rio
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
        toast.error('Erro ao carregar configuraÃ§Ãµes');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [user, role, escolaAtivaId]);

  const handleSaveEscola = async () => {
    if (!escolaAtivaId) return;
    try {
      const docRef = doc(db, 'escolas', escolaAtivaId);
      await setDoc(docRef, {
        inep: escolaConfig.inep,
        nome: escolaConfig.nome,
        decreto_criacao: escolaConfig.decretoCriacao,
        email: escolaConfig.email,
        telefone: escolaConfig.telefone,
        zona: escolaConfig.zona,
        endereco: escolaConfig.endereco,
        horario_funcionamento: escolaConfig.horarioFuncionamento
      }, { merge: true });
      await logActivity('atualizou as informaÃ§Ãµes da escola.');
      toast.success('InformaÃ§Ãµes da escola salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar informaÃ§Ãµes da escola');
      console.error(error);
    }
  };

  const handleSaveInstalacoes = async () => {
    if (!escolaAtivaId) return;
    try {
      const docRef = doc(db, 'escolas', escolaAtivaId);
      await setDoc(docRef, {
        salas_aula: instalacoes.salasAula.toString(),
        laboratorios: instalacoes.laboratorios.toString(),
        banheiros: instalacoes.banheiros.toString(),
        cantina: instalacoes.cantina.toString(),
        biblioteca: instalacoes.biblioteca.toString(),
        quadras: instalacoes.quadras.toString(),
        secretaria: instalacoes.secretaria.toString(),
        salaProfessores: instalacoes.salaProfessores.toString(),
      }, { merge: true });
      await logActivity('atualizou as informaÃ§Ãµes das instalaÃ§Ãµes da escola.');
      toast.success('InstalaÃ§Ãµes atualizadas com sucesso!');
      setIsInstalacoesOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar instalaÃ§Ãµes');
      console.error(error);
    }
  };

  const handleSavePreferencias = async (newPreferencias: typeof preferencias) => {
    setPreferencias(newPreferencias);
    // Salvar no localStorage para persistÃªncia imediata no navegador
    localStorage.setItem('telaCheiaPadrao', JSON.stringify(newPreferencias.telaCheiaPadrao));
    try {
      const docRef = doc(db, 'configuracoes', 'escola');
      await setDoc(docRef, { preferencias: newPreferencias }, { merge: true });
      await logActivity('atualizou as preferÃªncias do sistema.');
      toast.success('PreferÃªncias salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar preferÃªncias');
      console.error(error);
    }
  };

  const handleSaveProfile = async () => {
    if (profileData.novaSenha && profileData.novaSenha !== profileData.confirmarSenha) {
      toast.error('As senhas nÃ£o coincidem');
      return;
    }

    if (!user) {
      toast.error('UsuÃ¡rio nÃ£o autenticado.');
      return;
    }

    try {
      // TODO: Implementar atualizaÃ§Ã£o de senha usando a funÃ§Ã£o do AuthContext
      // if (profileData.novaSenha) { ... }

      const profileDocRef = doc(db, 'profiles', user.uid);
      const dataToUpdate = {
        nome: profileData.nome,
        telefone: profileData.telefone,
      };
      await setDoc(profileDocRef, dataToUpdate, { merge: true });

      await logActivity('atualizou as informaÃ§Ãµes do seu perfil.');
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
    toast.info('Iniciando a sincronizaÃ§Ã£o dos dados de busca. Isso pode levar alguns minutos...');

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
        toast.success('Todos os registros jÃ¡ estÃ£o sincronizados.');
      }

    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
      toast.error('Ocorreu um erro durante a sincronizaÃ§Ã£o.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    toast.info('Iniciando a injeÃ§Ã£o do INEP "13034243" nos registros antigos. Aguarde...');

    try {
      const collections = ['estudantes', 'professores', 'turmas', 'equipe_gestora', 'user_roles', 'frequencias', 'dias_letivos'];
      let count = 0;

      for (const coll of collections) {
        const snapshot = await getDocs(collection(db, coll));
        let batch = writeBatch(db);
        let opsInBatch = 0;

        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.escola_id) {
            batch.update(docSnap.ref, { escola_id: '13034243' });
            opsInBatch++;
            count++;
          }

          if (opsInBatch >= 490) {
            batch.commit();
            batch = writeBatch(db);
            opsInBatch = 0;
          }
        });

        if (opsInBatch > 0) {
          await batch.commit();
        }
      }

      toast.success(`${count} registros atualizados com o INEP 13034243!`);
      await logActivity('executou o script de migraÃ§Ã£o do tenant para 13034243.');
    } catch (error) {
      console.error("Erro ao migrar dados:", error);
      toast.error('Ocorreu um erro durante a migraÃ§Ã£o. Verifique o console.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleLimparTransferidos = async () => {
    const confirmado = window.confirm(
      'Isso irÃ¡ limpar o escola_id de todos os estudantes com status "Transferido" que ainda possuem uma escola vinculada, tornando-os disponÃ­veis para rematrÃ­cula em qualquer unidade. Deseja continuar?'
    );
    if (!confirmado) return;

    setIsMigrating(true);
    toast.info('Limpando escola dos estudantes Transferidos. Aguarde...');

    try {
      const snapshot = await getDocs(
        query(collection(db, 'estudantes'), where('status', '==', 'Transferido'))
      );

      let count = 0;
      let batch = writeBatch(db);
      let opsInBatch = 0;

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        // Apenas limpa os que tÃªm uma escola vinculada (nÃ£o-vazia)
        if (data.escola_id && data.escola_id !== '') {
          batch.update(docSnap.ref, { escola_id: '', turma_id: null });
          opsInBatch++;
          count++;
        }

        if (opsInBatch >= 490) {
          batch.commit();
          batch = writeBatch(db);
          opsInBatch = 0;
        }
      });

      if (opsInBatch > 0) {
        await batch.commit();
      }

      toast.success(`${count} estudante(s) transferido(s) tiveram sua escola removida com sucesso!`);
      await logActivity(`executou o script de limpeza de escola de ${count} estudante(s) transferido(s).`);
    } catch (error) {
      console.error('Erro ao limpar transferidos:', error);
      toast.error('Ocorreu um erro. Verifique o console.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCriarUsuariosFaltantes = async () => {
    const confirmado = window.confirm(
      'Isso irÃ¡ checar Professores, Estudantes e Equipe Gestora.\nTodos os cadastros COM e-mail que NÃƒO sejam um usuÃ¡rio terÃ£o um usuÃ¡rio criado no Firebase Authentication com senha "EDUCAFACIL2026".\n\nIsso pode demorar vÃ¡rios minutos. VocÃª tem certeza que quer rodar isso?'
    );
    if (!confirmado) return;

    setIsMigrating(true);
    toast.info('Buscando cadastros e criando acessos no Firebase... Pode demorar.');

    try {
      // ImportaÃ§Ãµes dinÃ¢micas necessÃ¡rias para criar Secondary App no Firebase Auth
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');

      // ConfiguraÃ§Ã£o copiada do environment
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };

      // Inicia um app secundÃ¡rio para nÃ£o deslogar o admin atual ()
      const apps = getApps();
      const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      const colecoes = [
        { name: 'professores', role: 'professor' },
        { name: 'equipe_gestora', role: 'gestor' },
        { name: 'estudantes', role: 'estudante' }
      ];

      let createdCount = 0;
      let errorCount = 0;

      // Load current profiles emails to skip existing more quickly
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const existingEmails = new Set(profilesSnap.docs.map(d => d.data().email?.toLowerCase()));

      for (const colInfo of colecoes) {
        // Obter os cadastros
        const snapshot = await getDocs(collection(db, colInfo.name));

        for (const docSnap of snapshot.docs) {
          const id = docSnap.id;
          const email = docSnap.data().email;
          const nome = docSnap.data().nome;
          const escola_id = docSnap.data().escola_id || '';

          if (email && typeof email === 'string' && email.trim() !== '' && email.includes('@')) {
            const emailLower = email.trim().toLowerCase();

            // Apenas tentaremos criar se nÃ£o tiver um profile correspondente
            if (!existingEmails.has(emailLower)) {
              try {
                // 1. Cria usuÃ¡rio no Firebase Auth (Auth UI vai logar este usuÃ¡rio localmente no SecondaryAuth)
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailLower, "EDUCAFACIL2026");
                const authUid = userCredential.user.uid;
                existingEmails.add(emailLower);

                // 2. Prepara o batch de dados
                const batch = writeBatch(db);

                // Add profile entry vinculado ao id real do Auth
                const profileRef = doc(db, 'profiles', authUid);
                batch.set(profileRef, {
                  nome: nome || 'Sem nome',
                  email: emailLower,
                  telefone: docSnap.data().contato || docSnap.data().telefone || '',
                  cargo: colInfo.role,
                  foto_url: docSnap.data().foto_url || ''
                }, { merge: true });

                // Add robust user role entry
                const roleRef = doc(db, 'user_roles', authUid);
                batch.set(roleRef, {
                  role: colInfo.role,
                  status: 'ativo',
                  email: emailLower,
                  escola_id: escola_id,
                  escolas: escola_id ? [escola_id] : []
                }, { merge: true });

                // 3. Atualiza o cadastro original pra linkar com o authUid
                const originalRef = doc(db, colInfo.name, id);
                batch.update(originalRef, { usuario_id: authUid });

                // 4. Salva a transaÃ§Ã£o
                await batch.commit();
                createdCount++;

                // Delay curto para evitar bater rate limits muito rÃ¡pido do Firebase Auth
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (err: any) {
                console.error(`Erro ao criar Firebase Auth para ${emailLower}:`, err);
                if (err.code === 'auth/email-already-in-use') {
                  // Se o auth jÃ¡ existe lÃ¡, mas nÃ£o estÃ¡ no profiles, a gente registra no set pra pular
                  existingEmails.add(emailLower);
                }
                errorCount++;
              }
            }
          }
        }
      }

      // Finaliza processo
      if (createdCount > 0) {
        toast.success(`${createdCount} novos usuÃ¡rios e senhas foram gerados no Firebase Auth!`);
        await logActivity(`gerou ${createdCount} usuÃ¡rios no Firebase Authentication em lote.`);
      } else if (errorCount === 0) {
        toast.info("NÃ£o havia nenhum usuÃ¡rio novo pendente com e-mail vÃ¡lido para criar.");
      } else {
        toast.warning(`Terminou com ${errorCount} falhas de criaÃ§Ã£o. Observe o console.`);
      }

    } catch (error) {
      console.error('Erro na geraÃ§Ã£o de usuÃ¡rios faltantes:', error);
      toast.error('Falha ao rodar o script (Verifique o console).');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('NÃ£o foi possÃ­vel buscar a versÃ£o');
      const data = await response.json();

      if (data.version !== APP_VERSION) {
        setNewVersionAvailable({ version: data.version, notes: data.notes });
        toast.info(`Nova versÃ£o ${data.version} disponÃ­vel!`);
      } else {
        toast.success('Seu sistema jÃ¡ estÃ¡ atualizado.');
        setNewVersionAvailable(null);
      }
    } catch (error) {
      console.error('Erro ao verificar atualizaÃ§Ã£o:', error);
      toast.error('Erro ao verificar atualizaÃ§Ãµes.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    toast.info('Limpando cache e atualizando... Aguarde.');
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload();
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <AppLayout title="ConfiguraÃ§Ãµes">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="ConfiguraÃ§Ãµes">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie as configuraÃ§Ãµes do sistema</p>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* InformaÃ§Ãµes da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">InformaÃ§Ãµes da Escola</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">INEP</Label>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.inep}
                        disabled
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0 cursor-not-allowed opacity-70"
                      />
                    </div>
                  </div>
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
                    <Label className="text-xs text-muted-foreground">Decreto de CriaÃ§Ã£o</Label>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-muted-foreground invisible" /> {/* Placeholder for consistent alignment */}
                      <Input
                        value={escolaConfig.decretoCriacao}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, decretoCriacao: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                        placeholder="Informe o decreto"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">E-mail</Label>
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
                    <Label className="text-xs text-muted-foreground">Zona (Urbana/Rural)</Label>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Select value={escolaConfig.zona} onValueChange={(value) => setEscolaConfig({ ...escolaConfig, zona: value })}>
                        <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-medium focus:ring-0 w-full text-left">
                          <SelectValue placeholder="Selecione a Zona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Urbana">Urbana</SelectItem>
                          <SelectItem value="Rural - VÃ¡rzea">Rural - VÃ¡rzea</SelectItem>
                          <SelectItem value="Rural - Terra Firme">Rural - Terra Firme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">EndereÃ§o</Label>
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
                  <Label className="text-xs text-muted-foreground">HorÃ¡rio de Funcionamento</Label>
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
                  Salvar AlteraÃ§Ãµes
                </Button>
              </CardContent>
            </Card>

            {/* InstalaÃ§Ãµes da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">InstalaÃ§Ãµes da Escola</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsInstalacoesOpen(true)}>
                    <Building className="h-4 w-4 mr-2" />
                    Gerenciar InstalaÃ§Ãµes
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
                      <p className="text-sm text-muted-foreground">LaboratÃ³rios</p>
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

            {/* PreferÃªncias do Sistema */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">PreferÃªncias do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">NotificaÃ§Ãµes</p>
                      <p className="text-sm text-muted-foreground">
                        Receber notificaÃ§Ãµes de eventos e atividades
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
                      <p className="font-medium">AutenticaÃ§Ã£o em Dois Fatores</p>
                      <p className="text-sm text-muted-foreground">
                        Aumenta a seguranÃ§a da sua conta
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
                        O sistema sempre iniciarÃ¡ em modo de tela cheia
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

            {/* InformaÃ§Ãµes da Conta */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">InformaÃ§Ãµes da Conta</CardTitle>
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

            {/* Sistema e VersÃ£o */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Wrench className="h-5 w-5" /> VersÃ£o do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">VersÃ£o do App</p>
                    <p className="text-sm text-muted-foreground">VersÃ£o Local: v{APP_VERSION}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                  >
                    {isCheckingUpdate ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : 'Verificar AtualizaÃ§Ãµes'}
                  </Button>
                </div>

                {newVersionAvailable && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-primary">Nova VersÃ£o DisponÃ­vel: v{newVersionAvailable.version}</p>
                        <p className="text-xs text-muted-foreground mt-1">{newVersionAvailable.notes}</p>
                      </div>
                      <Button size="sm" onClick={handleApplyUpdate}> Atualizar Agora
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Nota: A atualizaÃ§Ã£o irÃ¡ limpar o cache local e recarregar a pÃ¡gina. Seus dados no Firebase nÃ£o serÃ£o afetados.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ManutenÃ§Ã£o do Sistema */}
            {role === 'admin' && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">ManutenÃ§Ã£o do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Modo de ManutenÃ§Ã£o</p>
                          <p className="text-sm text-muted-foreground">
                            Sistema disponÃ­vel apenas para administradores
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
                        Se a busca por nome nÃ£o encontrar registros antigos, clique no botÃ£o abaixo para sincronizar os dados.
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

                      <Button
                        className="w-full mt-4"
                        variant="destructive"
                        onClick={handleMigrateData}
                        disabled={isSyncing || isMigrating}
                      >
                        {isMigrating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-2" />
                        )}
                        {isMigrating ? 'Migrando...' : 'Injetar INEP 13034243 nos dados antigos'}
                      </Button>

                      <Button
                        className="w-full mt-4"
                        variant="outline"
                        onClick={handleLimparTransferidos}
                        disabled={isSyncing || isMigrating}
                      >
                        {isMigrating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-2" />
                        )}
                        {isMigrating ? 'Limpando...' : 'Limpar Escola dos Transferidos'}
                      </Button>

                      <Button
                        className="w-full mt-4"
                        variant="secondary"
                        onClick={handleCriarUsuariosFaltantes}
                        disabled={isSyncing || isMigrating}
                      >
                        {isMigrating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserCog className="h-4 w-4 mr-2" />
                        )}
                        {isMigrating ? 'Criando usuÃ¡rios...' : 'Criar UsuÃ¡rios a partir de Cadastros (E-mail)'}
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
                Atualize suas informaÃ§Ãµes pessoais abaixo.
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
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-senha">Nova Senha</Label>
                <Input
                  id="profile-senha"
                  type="password"
                  placeholder="Deixe em branco para nÃ£o alterar"
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
                  Salvar AlteraÃ§Ãµes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Gerenciar InstalaÃ§Ãµes */}
        <Dialog open={isInstalacoesOpen} onOpenChange={setIsInstalacoesOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar InstalaÃ§Ãµes da Escola</DialogTitle>
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
                <Label htmlFor="laboratorios">LaboratÃ³rios</Label>
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
                Salvar AlteraÃ§Ãµes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
