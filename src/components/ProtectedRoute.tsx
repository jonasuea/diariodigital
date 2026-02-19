import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const loading = authLoading || roleLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="h-10 w-10 text-warning" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Pendente</h1>
          <p className="text-muted-foreground mb-6">
            Seu cadastro foi realizado com sucesso, mas você ainda não tem permissão para acessar o sistema. 
            Entre em contato com o administrador para solicitar acesso.
          </p>
          <Button variant="outline" onClick={async () => await signOut()}>
            Voltar para Login
          </Button>
        </div>
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Você não tem permissão para acessar esta página. 
            Se você acredita que isso é um erro, entre em contato com o administrador.
          </p>
          <Button variant="outline" onClick={async () => await signOut()}>
            Voltar para Login
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
