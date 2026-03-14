import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const roleDocRef = doc(db, 'user_roles', authUser.uid);
          const roleDoc = await getDoc(roleDocRef);
          const roleData = roleDoc.data();
          
          // Aceita qualquer role reconhecido em qualquer sistema.
          // O redirecionamento para o sistema correto é feito na EscolhaPerfil.
          const ALL_KNOWN_ROLES = ['admin', 'professor', 'gestor', 'pedagogo', 'secretario', 'responsavel', 'estudante'];
          const extraRoles: string[] = (roleData?.roles || []).map((r: any) => r.role);
          const primaryRole: string | null = roleData?.role || null;
          const allRoles = [...new Set([primaryRole, ...extraRoles])].filter(Boolean) as string[];
          
          const hasAccess = allRoles.some(r => ALL_KNOWN_ROLES.includes(r));
          
          if (!hasAccess || roleData?.status === 'inativo') {
            await firebaseSignOut(auth);
            setUser(null);
          } else {
            setUser(authUser);
          }
        } catch (error) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;

      const maintenanceDocRef = doc(db, 'configuracoes', 'escola');
      const roleDocRef = doc(db, 'user_roles', loggedInUser.uid);

      const [maintenanceDoc, roleDoc] = await Promise.all([
        getDoc(maintenanceDocRef),
        getDoc(roleDocRef)
      ]);

      const maintenanceData = maintenanceDoc.data();
      const roleData = roleDoc.data();

      const isInMaintenance = maintenanceData?.preferencias?.modoManutencao || false;
      const primaryRole: string | null = roleData?.role || null;

      // Coleta todos os perfis do usuário (primário + array roles[])
      const ALL_KNOWN_ROLES = ['admin', 'professor', 'gestor', 'pedagogo', 'secretario', 'responsavel', 'estudante'];
      const extraRoles: string[] = (roleData?.roles || []).map((r: any) => r.role);
      const allRoles = [...new Set([primaryRole, ...extraRoles])].filter(Boolean) as string[];

      // Usuário é aceito se tiver qualquer perfil reconhecido em qualquer sistema.
      // O redirecionamento para o sistema correto acontece na tela EscolhaPerfil.
      const hasAnyAccess = allRoles.some(r => ALL_KNOWN_ROLES.includes(r));

      if (isInMaintenance && primaryRole !== 'admin') {
        await firebaseSignOut(auth);
        const maintenanceError = new Error("O sistema está em modo de manutenção. Apenas administradores podem fazer login.");
        maintenanceError.name = 'MaintenanceMode';
        return { error: maintenanceError };
      }

      if (!hasAnyAccess) {
        await firebaseSignOut(auth);
        const roleError = new Error("Acesso negado. Seu usuário não possui nenhum perfil ativo nos sistemas.");
        roleError.name = 'RoleRestriction';
        return { error: roleError };
      }

      if (roleData?.status === 'inativo') {
        await firebaseSignOut(auth);
        const statusError = new Error("Sua conta está inativa. Entre em contato com o administrador.");
        statusError.name = 'InactiveUser';
        return { error: statusError };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: nome });

      // Criar perfil no Firestore
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        nome: nome,
        email: userCredential.user.email,
        created_at: new Date(),
        excluido: false
      });

      // Criar role de usuário (pendente por padrão, aguardando aprovação do admin)
      await setDoc(doc(db, 'user_roles', userCredential.user.uid), {
        user_id: userCredential.user.uid,
        role: 'pending',
        status: 'ativo'
      });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}