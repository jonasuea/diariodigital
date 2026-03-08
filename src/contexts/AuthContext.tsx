import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
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
      const userRole = roleData?.role || null;

      if (isInMaintenance && userRole !== 'admin') {
        await firebaseSignOut(auth);
        const maintenanceError = new Error("O sistema está em modo de manutenção. Apenas administradores podem fazer login.");
        maintenanceError.name = 'MaintenanceMode';
        return { error: maintenanceError };
      }

      if (userRole === 'responsavel') {
        await firebaseSignOut(auth);
        const roleError = new Error("Responsáveis devem acessar pelo portal de matriculas: matricula.manaus.am.gov.br");
        roleError.name = 'RoleRestriction';
        return { error: roleError };
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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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