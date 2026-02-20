import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

interface MaintenanceConfig {
  preferencias?: {
    modoManutencao?: boolean;
  };
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig | null>(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);

  useEffect(() => {
    const fetchMaintenanceStatus = async () => {
      try {
        const docRef = doc(db, 'configuracoes', 'escola');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMaintenanceConfig(docSnap.data() as MaintenanceConfig);
        }
      } catch (error) {
        console.error("Failed to fetch maintenance status:", error);
      } finally {
        setLoadingMaintenance(false);
      }
    };

    fetchMaintenanceStatus();
  }, []);

  const loading = authLoading || roleLoading || loadingMaintenance;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (maintenanceConfig?.preferencias?.modoManutencao && role !== 'admin') {
    return <Navigate to="/manutencao" />;
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
