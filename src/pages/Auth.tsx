import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useOfflineStatus } from '@/contexts/OfflineStatusContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function Auth() {
  const { t } = useTranslation();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isOnline } = useOfflineStatus();

  const { role, loading: loadingRole, needsProfileSelection } = useUserRole();

  if (loading || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F1D1]">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
      </div>
    );
  }

  // Mapa de redirecionamento externo por perfil (igual ao EscolhaPerfil.tsx)
  const ROLE_EXTERNAL_URL: Record<string, string | null> = {
    professor: null,
    admin: null,
    estudante: 'https://souestudante.web.app',
    responsavel: 'https://matriculaonline.web.app',
    gestor: 'https://educafacil1.web.app',
    pedagogo: 'https://educafacil1.web.app',
    secretario: 'https://educafacil1.web.app',
  };

  if (user) {
    if (needsProfileSelection) {
      return <Navigate to="/escolha-perfil" replace />;
    }

    if (role) {
      const externalUrl = ROLE_EXTERNAL_URL[role];
      if (externalUrl) {
        // Redireciona para o sistema externo correto
        window.location.href = externalUrl;
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#F8F1D1]">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
            <span className="ml-2 text-[#8B6508]">Redirecionando para o sistema correto...</span>
          </div>
        );
      }
      // Professor ou admin: fica no Diário Digital
      return <Navigate to="/painel" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F1D1]">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
        <span className="ml-2 text-[#8B6508]">Verificando permissões...</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.name === 'MaintenanceMode') {
            toast.warning('Sistema em Manutenção', {
              description: 'Apenas administradores podem fazer login no momento.',
              duration: 6000,
            });
          } else if (error.name === 'InactiveUser') {
            toast.error(error.message);
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('E-mail ou senha incorretos');
          } else {
            toast.error('Sem permissão para fazer login: ' + error.message);
          }
        } else {
          toast.success(t('login.successLogin', 'Login realizado com sucesso!'));
        }
      } else {
        const { error } = await signUp(email, password, nome);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error(t('login.emailExists', 'Este email já está cadastrado'));
          } else {
            toast.error(t('login.errorCreateAccount', 'Sem permissão para criar conta: ') + error.message);
          }
        } else {
          toast.success(t('login.successCreateAccount', 'Conta criada! Aguarde a aprovação do administrador para acessar o sistema.'));
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setNome('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('Por favor, informe seu e-mail para recuperar a senha');
      return;
    }

    try {
      const { error } = await resetPassword(email);
      if (error) {
        if (error.message.includes('user-not-found')) {
          toast.error('Usuário não encontrado');
        } else {
          toast.error('Erro ao enviar e-mail de recuperação: ' + error.message);
        }
      } else {
        toast.info('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (e) {
      toast.error('Erro ao processar solicitação');
    }
  };

  return (
    <div className="min-h-screen auth-bg-main font-sans selection:bg-[#D4A017]/30 selection:text-[#8B6508]">
      {/* Top Header Strip */}
      <div className="auth-header-strip flex items-center justify-end px-8 md:px-20">
        <div className="bg-[#D4A017] rounded-b-xl px-4 py-1 shadow-md flex items-center gap-2 border-x border-b border-[#B8860B]">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 overflow-hidden">
            <img src="/timbre_semed.png" alt="Prefeitura" className="object-contain" />
          </div>
          <span className="text-white text-xs font-bold whitespace-nowrap">Prefeitura de Itacoatiara</span>
        </div>
      </div>

      {/* Decorative Icons Background */}
      <div className="auth-icons-pattern" />

      {/* Background Shape */}
      <div className="auth-shape-left hidden lg:block" />

      <main className="relative z-10 flex flex-col lg:flex-row min-h-screen items-center justify-center px-6 py-12 lg:px-20 gap-12 lg:gap-24">

        {/* Left Aspect - Logo and Brand Info */}
        <div className="flex flex-col items-center lg:items-start max-w-lg text-center lg:text-left space-y-6">
          <div className="relative">
            <img
              src="/timbre_semed.png"
              alt="Diário Digital Semed"
              className="h-48 md:h-64 object-contain filter drop-shadow-xl"
              style={{ filter: 'sepia(1) saturate(2) hue-rotate(5deg) brightness(0.8)' }}
            />
            <div className="mt-4">
              <h2 className="text-4xl md:text-5xl font-black text-[#8B6508] tracking-tight">
                Diário <span className="text-[#D4A017]">Digital</span>
              </h2>
              <p className="text-lg font-bold text-[#8B6508]/70 tracking-widest uppercase">Semed</p>
            </div>
          </div>

          <div className="max-w-sm hidden md:block">
            <p className="text-[#8B6508]/80 leading-relaxed font-medium italic">
              O Diário Digital é uma aplicação web utilizada pelos docentes objetivando dinamizar o fazer pedagógico e manter uma base de dados centralizada e atualizada.
            </p>
          </div>
        </div>

        {/* Right Aspect - Login Card */}
        <div className="w-full max-w-md relative">
          {/* Floating Hat Icon */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#D4A017] w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border-2 border-white z-20">
            <GraduationCap className="text-white w-7 h-7" />
          </div>

          <div className="auth-card-premium pt-12">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#8B6508]">Diário Digital</h1>
              <p className="text-[#8B6508]/60 font-medium">{isLogin ? t('login.title') : t('login.titleCreate')}</p>
            </div>

            {!isOnline && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium flex items-center gap-2">
                <HelpCircle className="h-5 w-5 shrink-0" />
                <span>Modo Offline: O primeiro login após a instalação requer conexão com a internet.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-[#8B6508] font-bold ml-1">{t('login.name')}</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder={t('login.namePlaceholder')}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required={!isLogin}
                    className="dd-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#8B6508] font-bold ml-1">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="dd-input"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-[#8B6508] font-bold">{t('login.password')}</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('login.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="dd-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6508]/40 hover:text-[#8B6508] transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {isLogin && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs font-bold text-[#D4A017] hover:dd-text-gold transition-colors"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full dd-button"
                disabled={isSubmitting || !isOnline}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : !isOnline ? (
                  "Conexão requerida"
                ) : isLogin ? (
                  t('login.submitLogin')
                ) : (
                  t('login.submitCreate')
                )}
              </Button>
            </form>

            <div className="mt-8 text-center space-y-4">

              <div className="pt-6 border-t border-[#8B6508]/10 text-xs text-[#8B6508]/50 flex flex-col items-center gap-1">
                <p className="font-bold uppercase tracking-wider">{t('login.devMessage1')}</p>
                <p>{t('login.devMessage2')} - {t('login.devMessage3')}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating help button - matched to screenshot circle-? */}
      <div className="fixed bottom-8 left-8 z-50">
        <button className="w-14 h-14 bg-[#D4A017] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all">
          <HelpCircle size={32} />
        </button>
      </div>
    </div>
  );
}
