import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estudanteId, setEstudanteId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { role, loading: loadingRole, needsProfileSelection } = useUserRole();

  useEffect(() => {
    if (user && role === 'estudante') {
      const fetchEstudanteId = async () => {
        try {
          const q = query(collection(db, 'estudantes'), where('usuario_id', '==', user.uid), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setEstudanteId(snap.docs[0].id);
          } else {
            setEstudanteId('fallback');
          }
        } catch (e) {
          console.error(e);
          setEstudanteId('fallback');
        }
      };
      fetchEstudanteId();
    }
  }, [user, role]);

  if (loading || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    if (needsProfileSelection) {
      return <Navigate to="/escolha-perfil" replace />;
    }

    if (role === 'estudante') {
      if (!estudanteId) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Localizando perfil do estudante...</span>
          </div>
        );
      }
      return <Navigate to="/painel" replace />;
    }

    // We only redirect to painel if the role is resolved, to prevent race conditions 
    // where user is true but role is still null during the first renders
    if (role) {
      return <Navigate to="/painel" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando permissões...</span>
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
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('E-mail ou senha incorretos');
          } else {
            toast.error('Sem permissão para fazer login: ' + error.message);
          }
        } else {
          toast.success('Login realizado com sucesso!');
        }
      } else {
        const { error } = await signUp(email, password, nome);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Este email já está cadastrado');
          } else {
            toast.error('Sem permissão para criar conta: ' + error.message);
          }
        } else {
          toast.success('Conta criada! Aguarde a aprovação do administrador para acessar o sistema.');
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

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                <GraduationCap className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">EducaFácil</h1>
            <p className="mt-2 text-muted-foreground">
              {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={!isLogin}
                  className="h-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLogin ? (
                'Entrar'
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-primary hover:underline"
            >
              {/*isLogin ? 'Criar conta' : 'Fazer login'*/}
            </button>
          </p>

          {/* 🔵 Mensagem adicionada exatamente na área indicada */}
          <div className="mt-4 p-4 rounded-lg bg-blue-50 text-center text-sm text-blue-700 border border-blue-200">
            <p className="font-semibold">Aplicação em desenvolvimento</p>
            <p>##<strong>Para acessar, fale com o Professor Jonas</strong></p>
            <p>##<strong>Escola Dom Paulo</strong></p>
          </div>

        </div>
      </div>

      {/* Right side - Image/Branding */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <GraduationCap className="h-24 w-24 mx-auto mb-8 opacity-90" />
          <h2 className="text-4xl font-bold mb-4">
            Sistema de Gestão Escolar
          </h2>
          <p className="text-lg opacity-90">
            Gerencie Estudantes, professores, turmas e muito mais de forma simples e eficiente.
          </p>
        </div>
      </div>
    </div>
  );
}
