import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const [accessStatus, setAccessStatus] = useState<'checking' | 'granted' | 'denied'>('checking');

  useEffect(() => {
    async function checkUserAccess() {
      if (!user) {
        setAccessStatus('denied');
        return;
      }

      setAccessStatus('checking');

      try {
        const userDocRef = doc(db, 'user_roles', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const role = userDoc.data()?.role;
          if (role && role !== 'pending') {
            setAccessStatus('granted');
          } else {
            setAccessStatus('denied');
          }
        } else {
          // Criar perfil se não existir
          const profileRef = doc(db, 'profiles', user.uid);
          const profileDoc = await getDoc(profileRef);
          if (!profileDoc.exists()) {
            await setDoc(profileRef, {
              nome: user.displayName || user.email || 'Usuário',
              email: user.email,
              created_at: new Date()
            });
          }

          // Criar role automaticamente para o primeiro usuário ou usuários sem role
          await setDoc(userDocRef, {
            user_id: user.uid,
            role: 'pending',
            status: 'ativo'
          });
          setAccessStatus('denied');
        }
      } catch (error) {
        console.error('Error checking user access:', error);
        setAccessStatus('denied');
      }
    }

    if (!loading) {
      checkUserAccess();
    }
  }, [user, loading]);

  if (loading || accessStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (accessStatus === 'denied') {
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
          <Button variant="outline" onClick={signOut}>
            Voltar para Login
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
