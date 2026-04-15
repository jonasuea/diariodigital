import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { School, Mail, Phone, MapPin, Clock, Bell, Shield, Wrench, User, Building, Loader2, Upload, Camera, UserCog, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { db, storage, functions, auth } from '@/lib/firebase';
import { logActivity } from '@/lib/logger';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { APP_VERSION } from '@/constants/version';
import { httpsCallable } from 'firebase/functions';
import { TwoFactorSetupDialog } from '@/components/TwoFactorSetupDialog';
import { multiFactor } from 'firebase/auth';

export default function Configuracoes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, escolaAtivaId } = useUserRole();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isInstalacoesOpen, setIsInstalacoesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [newVersionAvailable, setNewVersionAvailable] = useState<{ version: string, notes: string } | null>(null);

  // System global controls (shared with matriculaonline)
  const [systemConfig, setSystemConfig] = useState({
    manutencao: false,
    matriculas_abertas: true,
    manutencao_mensagem: 'Sistema em manutenção. Retornaremos em breve.',
    matriculas_fechadas_msg: 'O período de matrículas está encerrado. Aguarde a abertura.',
  });
  const [savingSystem, setSavingSystem] = useState(false);
  const [escolaConfig, setEscolaConfig] = useState({
    inep: '',
    nome: 'Escola Municipal Nome da Escola',
    decretoCriacao: '',
    email: 'contato@escolanome.edu.br',
    contato: '(11) 0000-0000',
    zona: '',
    endereco: 'Rua das Flores, 123 - São Paulo',
    horarioFuncionamento: 'Segunda a Sexta, 7h às 18h',
    matriculas_abertas: true,
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
    sincronizacaoOffline: false,
  });

  const [profileData, setProfileData] = useState({
    nome: 'Administrador',
    email: user?.email || 'admin@escola.edu.br',
    contato: '(11) 98765-4321',
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
            console.error(`Sem permissão para tentar ativar a tela cheia: ${err.message}`);
          }
        }
      } else {
        if (document.fullscreenElement !== null) {
          try {
            await document.exitFullscreen();
          } catch (err) {
            console.error(`Sem permissão para tentar desativar a tela cheia: ${err.message}`);
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
        // Preferências pessoais: lidas do perfil do usuário (qualquer role pode ler o próprio)
        // Admin também lê as preferências globais da escola como fallback
        if (user) {
          const profileDocRef = doc(db, 'profiles', user.uid);
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists() && profileSnap.data().preferencias) {
            const prefs = profileSnap.data().preferencias;
            setPreferencias(prefs);
            localStorage.setItem('telaCheiaPadrao', JSON.stringify(prefs.telaCheiaPadrao || false));
            localStorage.setItem('sincronizacaoOffline', JSON.stringify(prefs.sincronizacaoOffline || false));
          } else if (role === 'admin') {
            // Fallback para admin: ler preferências globais da escola
            const configDocRef = doc(db, 'configuracoes', 'escola');
            const configDocSnap = await getDoc(configDocRef);
            if (configDocSnap.exists() && configDocSnap.data().preferencias) {
              const prefs = configDocSnap.data().preferencias;
              setPreferencias(prefs);
              localStorage.setItem('telaCheiaPadrao', JSON.stringify(prefs.telaCheiaPadrao || false));
              localStorage.setItem('sincronizacaoOffline', JSON.stringify(prefs.sincronizacaoOffline || false));
            }
          }
        }

        // Carregar configurações do sistema global
        const sistemaDocRef = doc(db, 'configuracoes', 'sistema');
        const sistemaSnap = await getDoc(sistemaDocRef);
        if (sistemaSnap.exists()) {
          setSystemConfig(prev => ({ ...prev, ...sistemaSnap.data() }));
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
              contato: d.contato || prev.contato,
              zona: d.zona || prev.zona,
              endereco: d.endereco || prev.endereco,
              horarioFuncionamento: d.horario_funcionamento || prev.horarioFuncionamento,
              matriculas_abertas: d.matriculas_abertas !== undefined ? d.matriculas_abertas : true,
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
              contato: profile.contato || '',
              cargo: profile.cargo || role || prev.cargo,
              foto_url: profile.foto_url || '',
            }));
          }
        }
      } catch (error) {
        toast.error(t('settings.errors.loadConfig'));
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();

    // Detectar se o 2FA já está ativo para o usuário atual
    if (auth.currentUser) {
      const enrolled = multiFactor(auth.currentUser).enrolledFactors;
      setIs2FAEnabled(enrolled.length > 0);
    }
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
        contato: escolaConfig.contato,
        zona: escolaConfig.zona,
        endereco: escolaConfig.endereco,
        horario_funcionamento: escolaConfig.horarioFuncionamento,
        matriculas_abertas: escolaConfig.matriculas_abertas,
      }, { merge: true });
      await logActivity(t('settings.logs.updateSchool'));
      toast.success(t('settings.success.schoolSaved'));
    } catch (error) {
      toast.error(t('settings.errors.saveSchool'));
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
      await logActivity(t('settings.logs.updateFacilities'));
      toast.success(t('settings.success.facilitiesSaved'));
      setIsInstalacoesOpen(false);
    } catch (error) {
      toast.error(t('settings.errors.saveFacilities'));
      console.error(error);
    }
  };

  const handleSavePreferencias = async (newPreferencias: typeof preferencias) => {
    setPreferencias(newPreferencias);
    localStorage.setItem('telaCheiaPadrao', JSON.stringify(newPreferencias.telaCheiaPadrao));
    localStorage.setItem('sincronizacaoOffline', JSON.stringify(newPreferencias.sincronizacaoOffline || false));
    try {
      if (role === 'admin') {
        const docRef = doc(db, 'configuracoes', 'escola');
        console.log('[2FA-DEBUG] Tentando escrever em configuracoes/escola');
        await setDoc(docRef, { preferencias: newPreferencias }, { merge: true });
        console.log('[2FA-DEBUG] configuracoes/escola OK');
      }
      if (user) {
        const profileRef = doc(db, 'profiles', user.uid);
        console.log('[2FA-DEBUG] Tentando escrever em profiles/', user.uid, '| role:', role);
        await setDoc(profileRef, { preferencias: newPreferencias }, { merge: true });
        console.log('[2FA-DEBUG] profiles OK');
      }
      await logActivity(t('settings.logs.updatePreferences'));
      toast.success(t('settings.success.preferencesSaved'));
    } catch (error) {
      toast.error(t('settings.errors.savePreferences'));
      console.error('[2FA-DEBUG] ERRO:', error);
    }
  };

  const handleSaveSystemConfig = async (update: Partial<typeof systemConfig>) => {
    const newConfig = { ...systemConfig, ...update };
    setSystemConfig(newConfig);
    setSavingSystem(true);
    try {
      const ref = doc(db, 'configuracoes', 'sistema');
      await setDoc(ref, newConfig, { merge: true });
      await logActivity(t('settings.logs.updateSystem'));
      toast.success(t('settings.success.systemSaved'));
    } catch (error) {
      toast.error(t('settings.errors.saveSystem'));
      console.error(error);
    } finally {
      setSavingSystem(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profileData.novaSenha && profileData.novaSenha !== profileData.confirmarSenha) {
      toast.error(t('settings.errors.passwordsNoMatch'));
      return;
    }

    if (!user) {
      toast.error(t('settings.errors.notAuthenticated'));
      return;
    }

    try {
      // TODO: Implementar atualização de senha usando a função do AuthContext
      // if (profileData.novaSenha) { ... }

      const profileDocRef = doc(db, 'profiles', user.uid);
      const dataToUpdate = {
        nome: profileData.nome,
        contato: profileData.contato,
      };
      await setDoc(profileDocRef, dataToUpdate, { merge: true });

      await logActivity(t('settings.logs.updateProfile'));
      toast.success(t('settings.success.profileUpdated'));
      setIsEditProfileOpen(false);
      setProfileData(prev => ({ ...prev, novaSenha: '', confirmarSenha: '' }));
    } catch (error) {
      toast.error(t('settings.errors.updateProfile'));
      console.error(error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.errors.selectImage'));
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

      await logActivity(t('settings.logs.updatePhoto'));
      toast.success(t('settings.success.photoUpdated'));
    } catch (error) {
      toast.error(t('settings.errors.uploadPhoto'));
      console.error(error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSyncSearchData = async () => {
    setIsSyncing(true);
    toast.info(t('settings.info.syncingStart'));

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
        toast.success(t('settings.success.syncConcluded', { count: updatedCount }));
      } else {
        toast.success(t('settings.success.syncNoChanges'));
      }

    } catch (error) {
      console.error("Sem permissão para sincronizar dados:", error);
      toast.error(t('settings.errors.syncData'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLimparTransferidos = async () => {
    const confirmado = window.confirm(t('settings.confirm.clearTransferred'));
    if (!confirmado) return;

    setIsMigrating(true);
    toast.info(t('settings.info.clearingTransferredStart'));

    try {
      const snapshot = await getDocs(
        query(collection(db, 'estudantes'), where('status', '==', 'Transferido'))
      );

      let count = 0;
      let batch = writeBatch(db);
      let opsInBatch = 0;

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        // Apenas limpa os que tÃªm uma escola vinculada (não-vazia)
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

      toast.success(t('settings.success.clearTransferredConcluded', { count: count }));
      await logActivity(t('settings.logs.runClearTransferred', { count: count }));
    } catch (error) {
      console.error('Sem permissão para limpar transferidos:', error);
      toast.error(t('settings.errors.clearTransferred'));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCriarUsuariosFaltantes = async () => {
    const confirmado = window.confirm(t('settings.confirm.createUsers'));
    if (!confirmado) return;

    setIsMigrating(true);
    toast.info(t('settings.info.creatingUsersStart'));

    try {
      // ImportaçÃµes dinÃ¢micas necessárias para criar Secondary App no Firebase Auth
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');

      // Configuração copiada do environment
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };

      // Inicia um app secundário para não deslogar o admin atual ()
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

            // Apenas tentaremos criar se não tiver um profile correspondente
            if (!existingEmails.has(emailLower)) {
              try {
                // SEGURANÇA: Senha temporária gerada via Web Crypto API (criptograficamente segura)
                // O usuário deve usar "Esqueci a senha" no primeiro acesso para definir sua própria senha.
                const randomBytes = new Uint8Array(16);
                crypto.getRandomValues(randomBytes);
                const tempPassword = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('') + 'A1!';
                const createUser = httpsCallable(functions, 'createUserAccount');
                const result = await createUser({
                  email: emailLower,
                  password: tempPassword,
                  nome: nome || 'Sem nome',
                  role: colInfo.role,
                  escola_id: escola_id
                });

                const { uid } = result.data as { uid: string };
                existingEmails.add(emailLower);

                // Atualiza o cadastro original pra linkar com o authUid
                const batch = writeBatch(db);
                const originalRef = doc(db, colInfo.name, id);
                batch.update(originalRef, { usuario_id: uid });
                await batch.commit();

                createdCount++;
                // Delay curto para evitar bater rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (err: any) {
                console.error(`Erro ao processar usuário ${emailLower}:`, err);
                errorCount++;
              }
            }
          }
        }
      }

      // Finaliza processo
      if (createdCount > 0) {
        toast.success(t('settings.success.usersCreated', { count: createdCount }));
        await logActivity(t('settings.logs.runCreateUsers', { count: createdCount }));
      } else if (errorCount === 0) {
        toast.info(t('settings.success.usersNoPending'));
      } else {
        toast.warning(t('settings.errors.createUsers'));
      }

    } catch (error) {
      console.error('Erro na geração de usuários faltantes:', error);
      toast.error(t('settings.errors.createUsers'));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(t('settings.errors.checkUpdate'));
      const data = await response.json();

      if (data.version !== APP_VERSION) {
        setNewVersionAvailable({ version: data.version, notes: data.notes });
        toast.info(t('settings.success.updateAvailable', { version: data.version }));
      } else {
        toast.success(t('settings.success.systemUpdated'));
        setNewVersionAvailable(null);
      }
    } catch (error) {
      console.error('Sem permissão para verificar atualização:', error);
      toast.error(t('settings.errors.permissionCheckUpdate'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleFixMissingExcluido = async () => {
    const confirmado = window.confirm(t('settings.confirm.fixExcluded'));
    if (!confirmado) return;

    setIsMigrating(true);
    toast.info(t('settings.info.fixingExcludedStart'));

    try {
      const collectionsToMigrate = ['profiles', 'user_roles', 'equipe_gestora', 'professores', 'estudantes', 'turmas'];
      let totalUpdated = 0;

      for (const collName of collectionsToMigrate) {
        const snapshot = await getDocs(collection(db, collName));
        let batch = writeBatch(db);
        let opsInBatch = 0;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const updates: any = {};

          if (data.excluido === undefined) {
            updates.excluido = false;
          }

          // Garante que o nome exista para não quebrar o orderBy
          if (!data.nome || data.nome === 'Sem nome') {
            if (data.email) {
              updates.nome = data.email.split('@')[0];
            } else {
              updates.nome = 'Usuário sem Nome';
            }
          }

          if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
            opsInBatch++;
            totalUpdated++;
          }

          if (opsInBatch >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opsInBatch = 0;
          }
        }

        if (opsInBatch > 0) {
          await batch.commit();
        }
      }

      toast.success(t('settings.success.docsUpdated', { count: totalUpdated }));
      await logActivity(t('settings.logs.runFixExcluded', { count: totalUpdated }));
    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error(t('settings.errors.migrateData'));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleApplyUpdate = async () => {
    toast.info(t('settings.info.updatingCache'));
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload();
    } catch (error) {
      console.error('Sem permissão para limpar cache:', error);
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <AppLayout title={t('settings.title')}>
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('settings.title')}>
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">{t('settings.subtitle')}</p>

        <div className={role === 'professor' || role === 'estudante' || role === 'aluno' ? "max-w-3xl mx-auto space-y-6" : "grid gap-6 lg:grid-cols-3"}>
          {/* Se for Professor ou Estudante, mostrar layout simplificado na ordem solicitada */}
          {(role === 'professor' || role === 'estudante' || role === 'aluno') ? (
            <>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">{t('settings.account.title')}</CardTitle>
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
                  {uploadingPhoto && <p className="text-xs text-muted-foreground mb-2 animate-pulse">{t('settings.account.uploading')}</p>}
                  <h3 className="font-semibold text-lg">{profileData.nome}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{profileData.email}</p>
                  <Button variant="outline" className="w-full" onClick={() => setIsEditProfileOpen(true)}>
                    {t('settings.account.editButton')}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">{t('settings.preferences.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{t('settings.preferences.notifications')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.preferences.notificationsDesc')}
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
                        <p className="font-medium">{t('settings.preferences.twoFactor')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.preferences.twoFactorDesc')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={is2FAEnabled ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setIs2FADialogOpen(true)}
                    >
                      {is2FAEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{t('settings.preferences.fullscreen')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.preferences.fullscreenDesc')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferencias.telaCheiaPadrao}
                      onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, telaCheiaPadrao: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <ToggleLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Sincronização Offline (Pré-Cache)</p>
                        <p className="text-sm text-muted-foreground">
                          Baixa os dados automaticamente para funcionamento sem internet.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferencias.sincronizacaoOffline || false}
                      onCheckedChange={(checked) => {
                        handleSavePreferencias({ ...preferencias, sincronizacaoOffline: checked });
                        if (checked && navigator.onLine) {
                          toast.info('Baixando dados e dependências para uso offline...');
                          // Trigger prefetching here
                          if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.ready.then(reg => {
                              reg.active?.postMessage({ type: 'PREFETCH_OFFLINE_DATA' });
                            });
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Wrench className="h-5 w-5" /> {t('settings.version.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="font-medium">{t('settings.version.appVersion')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.version.localVersion', { version: APP_VERSION })}</p>
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
                          {t('settings.version.checking')}
                        </>
                      ) : t('settings.version.checkButton')}
                    </Button>
                  </div>

                  {newVersionAvailable && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-primary">{t('settings.version.newAvailable', { version: newVersionAvailable.version })}</p>
                          <p className="text-xs text-muted-foreground mt-1">{newVersionAvailable.notes}</p>
                        </div>
                        <Button size="sm" onClick={handleApplyUpdate}> {t('settings.version.updateNow')}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        {t('settings.version.updateNote')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Coluna principal (Admin, Gestor, Secretário) */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold">{t('settings.school.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.school.inep')}</Label>
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
                        <Label className="text-xs text-muted-foreground">{t('settings.school.schoolName')}</Label>
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
                        <Label className="text-xs text-muted-foreground">{t('settings.school.decreto')}</Label>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-muted-foreground invisible" /> {/* Placeholder for consistent alignment */}
                          <Input
                            value={escolaConfig.decretoCriacao}
                            onChange={(e) => setEscolaConfig({ ...escolaConfig, decretoCriacao: e.target.value })}
                            className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                            placeholder={t('settings.school.decretoPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.school.email')}</Label>
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
                        <Label className="text-xs text-muted-foreground">{t('settings.school.contact')}</Label>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={escolaConfig.contato}
                            onChange={(e) => setEscolaConfig({ ...escolaConfig, contato: e.target.value })}
                            className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.school.zone')}</Label>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <Select value={escolaConfig.zona} onValueChange={(value) => setEscolaConfig({ ...escolaConfig, zona: value })}>
                            <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-medium focus:ring-0 w-full text-left">
                              <SelectValue placeholder={t('settings.school.zonePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Urbana">{t('settings.school.zoneOptions.urban')}</SelectItem>
                              <SelectItem value="Rural - Várzea">{t('settings.school.zoneOptions.ruralVarzea')}</SelectItem>
                              <SelectItem value="Rural - Terra Firme">{t('settings.school.zoneOptions.ruralTerraFirme')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.school.address')}</Label>
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

                    <div className="space-y-1 mt-4">
                      <Label className="text-xs text-muted-foreground">{t('settings.school.workingHours')}</Label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                          value={escolaConfig.horarioFuncionamento}
                          onChange={(e) => setEscolaConfig({ ...escolaConfig, horarioFuncionamento: e.target.value })}
                          className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/30 border-green-100 mt-4">
                      <div className="flex items-start gap-3">
                        <ToggleLeft className={`h-5 w-5 mt-0.5 ${escolaConfig.matriculas_abertas ? 'text-green-600' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="font-semibold text-sm">{t('settings.school.enrollmentStatus')}</p>
                          <p className="text-xs text-muted-foreground">
                            {escolaConfig.matriculas_abertas
                              ? t('settings.school.enrollmentOpen')
                              : t('settings.school.enrollmentClosed')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={escolaConfig.matriculas_abertas}
                        onCheckedChange={(checked) => setEscolaConfig({ ...escolaConfig, matriculas_abertas: checked })}
                      />
                    </div>

                    <Button onClick={handleSaveEscola} className="mt-2">
                      {t('settings.school.saveButton')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Instalações da Escola */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">{t('settings.facilities.title')}</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setIsInstalacoesOpen(true)}>
                        <Building className="h-4 w-4 mr-2" />
                        {t('settings.facilities.manageButton')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.classrooms')}</p>
                          <p className="text-2xl font-bold">{instalacoes.salasAula}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.labs')}</p>
                          <p className="text-2xl font-bold">{instalacoes.laboratorios}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.bathrooms')}</p>
                          <p className="text-2xl font-bold">{instalacoes.banheiros}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.cafeteria')}</p>
                          <p className="text-2xl font-bold">{instalacoes.cantina}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.library')}</p>
                          <p className="text-2xl font-bold">{instalacoes.biblioteca}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{t('settings.facilities.sportsCourts')}</p>
                          <p className="text-2xl font-bold">{instalacoes.quadras}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold">{t('settings.preferences.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">{t('settings.preferences.notifications')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('settings.preferences.notificationsDesc')}
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
                          <p className="font-medium">{t('settings.preferences.twoFactor')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('settings.preferences.twoFactorDesc')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={is2FAEnabled ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setIs2FADialogOpen(true)}
                      >
                        {is2FAEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">{t('settings.preferences.fullscreen')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('settings.preferences.fullscreenDesc')}
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

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold">{t('settings.account.title')}</CardTitle>
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
                    {uploadingPhoto && <p className="text-xs text-muted-foreground mb-2 animate-pulse">{t('settings.account.uploading')}</p>}
                    <h3 className="font-semibold text-lg">{profileData.nome}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{profileData.email}</p>
                    <Button variant="outline" className="w-full" onClick={() => setIsEditProfileOpen(true)}>
                      {t('settings.account.editButton')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Controle do Sistema — apenas admin */}
                {
                  role === 'admin' && (
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <ToggleLeft className="h-5 w-5 text-amber-600" />
                          {t('settings.control.title')}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{t('settings.control.description')}</p>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {/* Manutenção */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <Wrench className={`h-5 w-5 mt-0.5 ${systemConfig.manutencao ? 'text-amber-500' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="font-semibold">{t('settings.control.maintenanceMode')}</p>
                              <p className="text-sm text-muted-foreground">
                                {t('settings.control.maintenanceModeDesc')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={systemConfig.manutencao}
                            disabled={savingSystem}
                            onCheckedChange={(checked) => handleSaveSystemConfig({ manutencao: checked })}
                          />
                        </div>

                        {/* Mensagem de manutenção editável */}
                        {systemConfig.manutencao && (
                          <div className="space-y-1 pl-8">
                            <label className="text-xs text-muted-foreground font-medium">{t('settings.control.maintenanceMsgLabel')}</label>
                            <input
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                              value={systemConfig.manutencao_mensagem}
                              onChange={(e) => setSystemConfig(prev => ({ ...prev, manutencao_mensagem: e.target.value }))}
                              onBlur={() => handleSaveSystemConfig({ manutencao_mensagem: systemConfig.manutencao_mensagem })}
                            />
                          </div>
                        )}

                        <div className="border-t border-amber-200 pt-4" />

                        {/* Matrículas Abertas */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <School className={`h-5 w-5 mt-0.5 ${systemConfig.matriculas_abertas ? 'text-green-500' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="font-semibold">{t('settings.control.enrollmentOverall')}</p>
                              <p className="text-sm text-muted-foreground">
                                {systemConfig.matriculas_abertas
                                  ? t('settings.control.enrollmentOverallOpen')
                                  : t('settings.control.enrollmentOverallClosed')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={systemConfig.matriculas_abertas}
                            disabled={savingSystem}
                            onCheckedChange={(checked) => handleSaveSystemConfig({ matriculas_abertas: checked })}
                          />
                        </div>

                        {/* Mensagem de matrículas fechadas editável */}
                        {!systemConfig.matriculas_abertas && (
                          <div className="space-y-1 pl-8">
                            <label className="text-xs text-muted-foreground font-medium">{t('settings.control.enrollmentMsgLabel')}</label>
                            <input
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                              value={systemConfig.matriculas_fechadas_msg}
                              onChange={(e) => setSystemConfig(prev => ({ ...prev, matriculas_fechadas_msg: e.target.value }))}
                              onBlur={() => handleSaveSystemConfig({ matriculas_fechadas_msg: systemConfig.matriculas_fechadas_msg })}
                            />
                          </div>
                        )}

                        {savingSystem && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> {t('settings.info.saving')}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                }

                {/* Sistema e Versão */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Wrench className="h-5 w-5" /> {t('settings.version.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <p className="font-medium">{t('settings.version.appVersion')}</p>
                        <p className="text-sm text-muted-foreground">{t('settings.version.localVersion', { version: APP_VERSION })}</p>
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
                            {t('settings.version.checking')}
                          </>
                        ) : t('settings.version.checkButton')}
                      </Button>
                    </div>

                    {newVersionAvailable && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-primary">{t('settings.version.newAvailable', { version: newVersionAvailable.version })}</p>
                            <p className="text-xs text-muted-foreground mt-1">{newVersionAvailable.notes}</p>
                          </div>
                          <Button size="sm" onClick={handleApplyUpdate}> {t('settings.version.updateNow')}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          {t('settings.version.updateNote')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Manutenção do Sistema */}
                {role === 'admin' && (
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold">{t('settings.maintenance.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-4 mb-2">
                          <div className="flex items-start gap-3">
                            <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">{t('settings.maintenance.maintenanceMode')}</p>
                              <p className="text-sm text-muted-foreground">
                                {t('settings.maintenance.maintenanceModeDesc')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={preferencias.modoManutencao}
                            onCheckedChange={(checked) => handleSavePreferencias({ ...preferencias, modoManutencao: checked })}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground mb-2 mt-4">
                            {t('settings.maintenance.toolsDesc')}
                          </p>

                          <Button
                            className="w-full justify-start"
                            variant="outline"
                            onClick={handleSyncSearchData}
                            disabled={isSyncing || isMigrating}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Wrench className="h-4 w-4 mr-2" />
                            )}
                            {isSyncing ? t('settings.info.syncing') : t('settings.maintenance.syncButton')}
                          </Button>

                          <Button
                            className="w-full justify-start"
                            variant="outline"
                            onClick={handleFixMissingExcluido}
                            disabled={isSyncing || isMigrating}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            {t('settings.maintenance.fixExcludedButton')}
                          </Button>

                          <Button
                            className="w-full justify-start"
                            variant="outline"
                            onClick={handleCriarUsuariosFaltantes}
                            disabled={isSyncing || isMigrating}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            {t('settings.maintenance.createUsersButton')}
                          </Button>

                          <Button
                            className="w-full justify-start text-amber-600 border-amber-200 hover:bg-amber-50"
                            variant="outline"
                            onClick={handleLimparTransferidos}
                            disabled={isSyncing || isMigrating}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            {t('settings.maintenance.clearTransferredButton')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>

        {/* Dialog 2FA */}
        <TwoFactorSetupDialog
          open={is2FADialogOpen}
          onOpenChange={setIs2FADialogOpen}
          isEnabled={is2FAEnabled}
          onStatusChange={(enabled) => setIs2FAEnabled(enabled)}
        />

        {/* Dialog Editar Perfil */}
        <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('settings.dialogs.editProfileTitle')}</DialogTitle>
              <DialogDescription>
                {t('settings.dialogs.editProfileDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-nome">{t('settings.school.name')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-nome"
                    className="pl-10"
                    value={profileData.nome}
                    onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                    disabled={role !== 'admin'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">{t('settings.school.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    className="pl-10"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    disabled={role !== 'admin'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-contato">{t('settings.school.contact')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-contato"
                    className="pl-10"
                    value={profileData.contato}
                    onChange={(e) => setProfileData({ ...profileData, contato: e.target.value })}
                    disabled={role !== 'admin'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-cargo">{t('settings.dialogs.role')}</Label>
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
                <Label htmlFor="profile-senha">{t('settings.dialogs.newPassword')}</Label>
                <Input
                  id="profile-senha"
                  type="password"
                  placeholder={t('settings.dialogs.passwordPlaceholder')}
                  value={profileData.novaSenha}
                  onChange={(e) => setProfileData({ ...profileData, novaSenha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirmar-senha">{t('settings.dialogs.confirmPassword')}</Label>
                <Input
                  id="profile-confirmar-senha"
                  type="password"
                  placeholder={t('settings.dialogs.confirmPasswordPlaceholder')}
                  value={profileData.confirmarSenha}
                  onChange={(e) => setProfileData({ ...profileData, confirmarSenha: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>
                  {t('settings.dialogs.cancelButton')}
                </Button>
                <Button onClick={handleSaveProfile}>
                  {t('settings.dialogs.saveButton')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Gerenciar Instalações */}
        <Dialog open={isInstalacoesOpen} onOpenChange={setIsInstalacoesOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('settings.dialogs.manageFacilitiesTitle')}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salasAula">{t('settings.facilities.classrooms')}</Label>
                <Input
                  id="salasAula"
                  type="number"
                  value={instalacoes.salasAula}
                  onChange={(e) => setInstalacoes({ ...instalacoes, salasAula: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laboratorios">{t('settings.facilities.labs')}</Label>
                <Input
                  id="laboratorios"
                  type="number"
                  value={instalacoes.laboratorios}
                  onChange={(e) => setInstalacoes({ ...instalacoes, laboratorios: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banheiros">{t('settings.facilities.bathrooms')}</Label>
                <Input
                  id="banheiros"
                  type="number"
                  value={instalacoes.banheiros}
                  onChange={(e) => setInstalacoes({ ...instalacoes, banheiros: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantina">{t('settings.facilities.cafeteria')}</Label>
                <Input
                  id="cantina"
                  type="number"
                  value={instalacoes.cantina}
                  onChange={(e) => setInstalacoes({ ...instalacoes, cantina: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biblioteca">{t('settings.facilities.library')}</Label>
                <Input
                  id="biblioteca"
                  type="number"
                  value={instalacoes.biblioteca}
                  onChange={(e) => setInstalacoes({ ...instalacoes, biblioteca: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quadras">{t('settings.facilities.sportsCourts')}</Label>
                <Input
                  id="quadras"
                  type="number"
                  value={instalacoes.quadras}
                  onChange={(e) => setInstalacoes({ ...instalacoes, quadras: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretaria">{t('settings.facilities.office')}</Label>
                <Input
                  id="secretaria"
                  type="number"
                  value={instalacoes.secretaria}
                  onChange={(e) => setInstalacoes({ ...instalacoes, secretaria: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaProfessores">{t('settings.facilities.teachersRoom')}</Label>
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
                {t('settings.dialogs.cancelButton')}
              </Button>
              <Button onClick={handleSaveInstalacoes}>
                {t('settings.dialogs.saveButton')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
