import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  UserCog,
  GraduationCap,
  School,
  Clock,
  FileText,
  Calendar,
  BookOpen,
  Settings,
  User,
  Building2,
  UserCheck,
  MessageSquare,
  LucideIcon
} from 'lucide-react';


interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  allowedRoles: string[];
}

const allMenuItems: MenuItem[] = [
  { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Escolas', url: '/escolas', icon: Building2, allowedRoles: ['admin'] },
  { title: 'Estudantes', url: '/Estudantes', icon: Users, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Responsáveis', url: '/responsaveis', icon: Users, allowedRoles: ['admin', 'gestor'] },
  { title: 'Pré-Matrículas', url: '/pre-matriculas', icon: UserCheck, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },

  { title: 'Professores', url: '/professores', icon: GraduationCap, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Equipe Gestora', url: '/equipe-gestora', icon: UserCog, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Turmas', url: '/turmas', icon: School, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Mensagens', url: '/mensagens', icon: MessageSquare, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Diário Digital', url: '/diario-digital', icon: BookOpen, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Relatórios', url: '/relatorios', icon: FileText, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Calendário', url: '/calendario', icon: Calendar, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Usuários', url: '/usuarios', icon: UserCog, allowedRoles: ['admin'] },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Manual de Uso', url: '/manual-uso', icon: BookOpen, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante'] },
];

export interface UserProfile {
  role: string;
  escola_id: string;
  escola_nome: string;
}

interface UserRoleContextType {
  role: string | null;
  escolaAtivaId: string | null;
  setEscolaAtivaId: (id: string | null) => void;
  loading: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isGestor: boolean;
  isPedagogo: boolean;
  isSecretario: boolean;
  isProfessor: boolean;
  isEstudante: boolean;
  isResponsavel: boolean;
  permittedEscolas: string[];
  menuItems: MenuItem[];
  isInMaintenance: boolean;
  // Multi-profile support
  availableProfiles: UserProfile[];
  activeProfile: UserProfile | null;
  setActiveProfile: (profile: UserProfile) => void;
  needsProfileSelection: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

const SESSION_ACTIVE_PROFILE_KEY = 'activeProfile';

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [escolaAtivaId, setEscolaAtivaId] = useState<string | null>(null);
  const [permittedEscolas, setPermittedEscolas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<UserProfile | null>(null);

  // Persist and apply a chosen profile
  function setActiveProfile(profile: UserProfile) {
    setActiveProfileState(profile);
    setRole(profile.role);
    setEscolaAtivaId(profile.escola_id);
    setPermittedEscolas([profile.escola_id]);
    sessionStorage.setItem(SESSION_ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem('escolaAtivaId', profile.escola_id);

    const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(profile.role));
    setMenuItems(accessibleItems);
  }

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setMenuItems([]);
        setAvailableProfiles([]);
        setActiveProfileState(null);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'user_roles', user.uid);
        const maintenanceRef = doc(db, 'configuracoes', 'escola');

        const [userDoc, maintenanceDoc] = await Promise.all([
          getDoc(userDocRef),
          getDoc(maintenanceRef)
        ]);

        if (maintenanceDoc.exists()) {
          setIsInMaintenance(maintenanceDoc.data()?.preferencias?.modoManutencao || false);
        }

        let userRole = null;
        let dbEscolaId = null;
        let dbEscolas: string[] = [];
        let dbRoles: UserProfile[] = [];

        if (userDoc.exists()) {
          const data = userDoc.data();
          userRole = data.role;
          setIsMaster(data.is_master || false);
          dbEscolaId = data.escola_id || null;
          dbEscolas = data.escolas || [];
          dbRoles = data.roles || [];
        }

        // ─── Multi-profile path ───────────────────────────────────────────────
        if (dbRoles.length > 1) {
          setAvailableProfiles(dbRoles);

          // Restore saved profile from session if still valid
          const savedJson = sessionStorage.getItem(SESSION_ACTIVE_PROFILE_KEY);
          if (savedJson) {
            try {
              const saved: UserProfile = JSON.parse(savedJson);
              const isValid = dbRoles.some(p => p.role === saved.role && p.escola_id === saved.escola_id);
              if (isValid) {
                setActiveProfile(saved);
                setLoading(false);
                return;
              }
            } catch (_) { /* invalid data — ignore */ }
          }

          // No valid saved profile → picker needed; leave role null
          setLoading(false);
          return;
        }

        // ─── Single-profile shortcut: roles array with exactly 1 entry ───────
        if (dbRoles.length === 1) {
          setAvailableProfiles(dbRoles);
          setActiveProfile(dbRoles[0]);
          setLoading(false);
          return;
        }

        // ─── Legacy path (no roles[] array) ──────────────────────────────────
        setRole(userRole);

        if (dbEscolas.length > 0) {
          setPermittedEscolas(dbEscolas);
          const savedEscola = sessionStorage.getItem('escolaAtivaId');
          if (savedEscola && dbEscolas.includes(savedEscola)) {
            setEscolaAtivaId(savedEscola);
          } else {
            setEscolaAtivaId(dbEscolas[0]);
            sessionStorage.setItem('escolaAtivaId', dbEscolas[0]);
          }
        } else if (dbEscolaId && userRole !== 'admin') {
          setEscolaAtivaId(dbEscolaId);
          setPermittedEscolas([dbEscolaId]);
          sessionStorage.setItem('escolaAtivaId', dbEscolaId);
        } else if (userRole === 'admin') {
          setPermittedEscolas([]);
          const savedEscola = sessionStorage.getItem('escolaAtivaId');
          if (savedEscola) {
            setEscolaAtivaId(savedEscola);
          }
        }

        if (userRole === 'estudante' || userRole === 'responsavel') {
          try {
            let q = query(collection(db, 'estudantes'), where('usuario_id', '==', user.uid), limit(1));
            let snap = await getDocs(q);

            if (snap.empty && user.email) {
              q = query(collection(db, 'estudantes'), where('email', '==', user.email.toLowerCase()), limit(1));
              snap = await getDocs(q);

              if (snap.empty) {
                q = query(collection(db, 'estudantes'), where('email_responsavel', '==', user.email.toLowerCase()), limit(1));
                snap = await getDocs(q);
              }
            }

            const estId = snap.empty ? 'not-found' : snap.docs[0].id;

            setMenuItems([
              { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Meu Perfil', url: `/estudantes/${estId}`, icon: User, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Manual de Uso', url: '/manual-uso', icon: BookOpen, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['estudante', 'responsavel'] }
            ]);
          } catch (e) {
            console.error('Erro ao buscar perfil de estudante. Carregando menus genéricos...', e);
            setMenuItems([
              { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Meu Perfil', url: `/estudantes/not-found`, icon: User, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['estudante', 'responsavel'] },
              { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['estudante', 'responsavel'] }
            ]);
          }
        } else if (userRole) {
          const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(userRole));
          setMenuItems(accessibleItems);
        } else {
          setMenuItems([]);
        }

      } catch (error) {
        console.error('Error fetching user role data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isMasterAdmin = role === 'admin' && isMaster;
  const isGestor = role === 'gestor';
  const isPedagogo = role === 'pedagogo';
  const isSecretario = role === 'secretario';
  const isProfessor = role === 'professor';
  const isEstudante = role === 'estudante';
  const isResponsavel = role === 'responsavel';

  // True when user has multiple profiles but hasn't selected one yet for this session
  const needsProfileSelection = availableProfiles.length > 1 && activeProfile === null && !loading;

  return (
    <UserRoleContext.Provider
      value={{
        role,
        escolaAtivaId,
        setEscolaAtivaId,
        loading,
        isAdmin,
        isMasterAdmin,
        isGestor,
        isPedagogo,
        isSecretario,
        isProfessor,
        isEstudante,
        isResponsavel,
        permittedEscolas,
        menuItems,
        isInMaintenance,
        availableProfiles,
        activeProfile,
        setActiveProfile,
        needsProfileSelection,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}