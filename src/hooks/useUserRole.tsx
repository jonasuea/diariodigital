import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, updateDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  BookOpen,
  Settings,
  User,
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
  { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['admin', 'professor'] },
  { title: 'Mensagens', url: '/mensagens', icon: MessageSquare, allowedRoles: ['admin', 'professor'] },
  { title: 'Diário Digital', url: '/diario-digital', icon: BookOpen, allowedRoles: ['admin', 'professor'] },
  { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['admin', 'professor'] },
  { title: 'Calendário', url: '/calendario', icon: Calendar, allowedRoles: ['admin', 'professor'] },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['admin', 'professor'] },
  { title: 'Manual de Uso', url: '/manual-uso', icon: BookOpen, allowedRoles: ['admin', 'professor'] },
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
  availableProfiles: UserProfile[];
  activeProfile: UserProfile | null;
  setActiveProfile: (profile: UserProfile) => void;
  needsProfileSelection: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

const SESSION_ACTIVE_PROFILE_KEY = 'activeProfile';
const PERMISSIONS_SNAPSHOT_KEY = (uid: string) => `user_permissions_snapshot_${uid}`;

interface PermissionsSnapshot {
  role: string | null;
  escolaAtivaId: string | null;
  permittedEscolas: string[];
  activeProfile: UserProfile | null;
  availableProfiles: UserProfile[];
  isMaster: boolean;
}

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

  // Auxiliar para carregar snapshot inicial por UID
  const getInitialSnapshot = (uid: string): PermissionsSnapshot | null => {
    try {
      const saved = localStorage.getItem(PERMISSIONS_SNAPSHOT_KEY(uid));
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  };

  // Efeito para carregar dados do snapshot assim que o usuário é detectado
  useEffect(() => {
    if (user?.uid) {
      const snapshot = getInitialSnapshot(user.uid);
      if (snapshot) {
        if (!role) setRole(snapshot.role);
        if (!escolaAtivaId) setEscolaAtivaId(snapshot.escolaAtivaId);
        if (permittedEscolas.length === 0) setPermittedEscolas(snapshot.permittedEscolas);
        if (!activeProfile) setActiveProfileState(snapshot.activeProfile);
        if (availableProfiles.length === 0) setAvailableProfiles(snapshot.availableProfiles);
        setIsMaster(snapshot.isMaster);
        
        // Se temos um role no snapshot, podemos parar o loading visual mais cedo se quisermos,
        // mas é melhor deixar o fetchUserRole terminar para garantir dados frescos.
        console.log("[useUserRole] Snapshot carregado para o usuário:", user.uid);
      }
    }
  }, [user?.uid]);

  const savePermissionsSnapshot = (data: Partial<PermissionsSnapshot>) => {
    if (!user?.uid) return;
    try {
      const current = getInitialSnapshot(user.uid) || {
        role: null,
        escolaAtivaId: null,
        permittedEscolas: [],
        activeProfile: null,
        availableProfiles: [],
        isMaster: false
      };
      const updated = { ...current, ...data };
      localStorage.setItem(PERMISSIONS_SNAPSHOT_KEY(user.uid), JSON.stringify(updated));
    } catch (e) {
      console.error("[useUserRole] Erro ao salvar snapshot de permissões:", e);
    }
  };

  async function setActiveProfile(profile: UserProfile) {
    setActiveProfileState(profile);
    setRole(profile.role);
    sessionStorage.setItem(SESSION_ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem('escolaAtivaId', profile.escola_id);

    const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(profile.role));
    setMenuItems(accessibleItems);

    // Para professores, busca todas as escolas onde está lotado
    if (profile.role === 'professor') {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const profByUid = await getDoc(doc(db, 'professores', currentUser.uid));
          if (profByUid.exists()) {
            const d = profByUid.data();
            const escolaIds: string[] = d.escola_ids?.length > 0 ? d.escola_ids : [profile.escola_id];
            setPermittedEscolas(escolaIds);
            const savedEscola = sessionStorage.getItem('escolaAtivaId');
            const escolaAtiva = (savedEscola && escolaIds.includes(savedEscola)) ? savedEscola : profile.escola_id;
            setEscolaAtivaId(escolaAtiva);
            sessionStorage.setItem('escolaAtivaId', escolaAtiva);
          } else {
            const profSnap = await getDocs(
              query(collection(db, 'professores'), where('usuario_id', '==', currentUser.uid), limit(1))
            );
            if (!profSnap.empty) {
              const d = profSnap.docs[0].data();
              const escolaIds: string[] = d.escola_ids?.length > 0 ? d.escola_ids : [profile.escola_id];
              setPermittedEscolas(escolaIds);
              const savedEscola = sessionStorage.getItem('escolaAtivaId');
              const escolaAtiva = (savedEscola && escolaIds.includes(savedEscola)) ? savedEscola : profile.escola_id;
              setEscolaAtivaId(escolaAtiva);
              sessionStorage.setItem('escolaAtivaId', escolaAtiva);
            } else {
              setPermittedEscolas([profile.escola_id]);
              setEscolaAtivaId(profile.escola_id);
            }
          }
        }
      } catch (_) {
        setPermittedEscolas([profile.escola_id]);
        setEscolaAtivaId(profile.escola_id);
      }
    } else {
      setPermittedEscolas([profile.escola_id]);
      setEscolaAtivaId(profile.escola_id);
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const userRoleRef = doc(db, 'user_roles', currentUser.uid);
      updateDoc(userRoleRef, {
        role: profile.role,
        escola_id: profile.escola_id,
      }).catch(err => {
        console.warn('Não foi possível sincronizar o perfil ativo no Firestore:', err);
      });

      // Atualiza o snapshot local
      savePermissionsSnapshot({
        role: profile.role,
        escolaAtivaId: profile.escola_id,
        activeProfile: profile
      });
    }
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

        // ─── Para professores: sempre busca escola_ids do documento professores ─
        // Isso garante que multi-lotação funciona independente do user_roles.escolas[]
        const isProfessorRole = userRole === 'professor' ||
          (dbRoles.length >= 1 && dbRoles.some(r => r.role === 'professor'));

        if (isProfessorRole) {
          // Busca o documento professores: primeiro pelo uid (ID do doc), depois por usuario_id
          let escolaIds: string[] = [];
          try {
            const profByUid = await getDoc(doc(db, 'professores', user.uid));
            if (profByUid.exists()) {
              const d = profByUid.data();
              escolaIds = d.escola_ids?.length > 0 ? d.escola_ids : (d.escola_id ? [d.escola_id] : []);
            } else {
              // Fallback: busca por usuario_id
              const profSnap = await getDocs(
                query(collection(db, 'professores'), where('usuario_id', '==', user.uid), limit(1))
              );
              if (!profSnap.empty) {
                const d = profSnap.docs[0].data();
                escolaIds = d.escola_ids?.length > 0 ? d.escola_ids : (d.escola_id ? [d.escola_id] : []);
              }
            }
          } catch (_) { /* ignore, use fallback below */ }

          // Fallback para user_roles se não encontrou no professores
          if (escolaIds.length === 0) {
            escolaIds = dbEscolas.length > 0 ? dbEscolas : (dbEscolaId ? [dbEscolaId] : []);
          }

          const savedEscola = sessionStorage.getItem('escolaAtivaId');
          const escolaAtiva = (savedEscola && escolaIds.includes(savedEscola)) ? savedEscola : (escolaIds[0] || '');

          setRole('professor');
          setPermittedEscolas(escolaIds);
          setEscolaAtivaId(escolaAtiva);
          if (escolaAtiva) sessionStorage.setItem('escolaAtivaId', escolaAtiva);

          // Perfil ativo para sessão
          const profileToUse = dbRoles.length >= 1
            ? dbRoles.find(r => r.role === 'professor') || dbRoles[0]
            : { role: 'professor', escola_id: escolaAtiva, escola_nome: '' };
          setActiveProfileState(profileToUse);
          sessionStorage.setItem(SESSION_ACTIVE_PROFILE_KEY, JSON.stringify(profileToUse));
          setAvailableProfiles(dbRoles.length >= 1 ? dbRoles : [profileToUse]);

          // Atualiza snapshot
          savePermissionsSnapshot({
            role: 'professor',
            escolaAtivaId: escolaAtiva,
            permittedEscolas: escolaIds,
            activeProfile: profileToUse,
            availableProfiles: dbRoles.length >= 1 ? dbRoles : [profileToUse],
            isMaster: isMaster
          });

          const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes('professor'));
          setMenuItems(accessibleItems);
          setLoading(false);
          return;
        }

        // ─── Multi-profile path (não-professor) ──────────────────────────────
        if (dbRoles.length > 1) {
          setAvailableProfiles(dbRoles);

          const savedJson = sessionStorage.getItem(SESSION_ACTIVE_PROFILE_KEY);
          if (savedJson) {
            try {
              const saved: UserProfile = JSON.parse(savedJson);
              const isValid = dbRoles.some(p => p.role === saved.role && p.escola_id === saved.escola_id);
              if (isValid) {
                await setActiveProfile(saved);
                setLoading(false);
                return;
              }
            } catch (_) { /* invalid data — ignore */ }
          }

          setLoading(false);
          return;
        }

        // ─── Single-profile shortcut: roles array with exactly 1 entry ───────
        if (dbRoles.length === 1) {
          setAvailableProfiles(dbRoles);
          if (dbRoles[0].role === 'professor' && dbEscolas.length > 1) {
            setRole(dbRoles[0].role);
            setPermittedEscolas(dbEscolas);
            const savedEscola = sessionStorage.getItem('escolaAtivaId');
            const escolaAtiva = (savedEscola && dbEscolas.includes(savedEscola)) ? savedEscola : dbEscolas[0];
            setEscolaAtivaId(escolaAtiva);
            sessionStorage.setItem('escolaAtivaId', escolaAtiva);
            setActiveProfileState(dbRoles[0]);
            sessionStorage.setItem(SESSION_ACTIVE_PROFILE_KEY, JSON.stringify(dbRoles[0]));
            const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(dbRoles[0].role));
            setMenuItems(accessibleItems);
            setLoading(false);
            return;
          }
          setActiveProfile(dbRoles[0]);
          
          // Atualiza snapshot para single profile
          savePermissionsSnapshot({
            role: dbRoles[0].role,
            escolaAtivaId: dbRoles[0].escola_id,
            permittedEscolas: dbEscolas.length > 0 ? dbEscolas : [dbRoles[0].escola_id],
            activeProfile: dbRoles[0],
            availableProfiles: dbRoles,
            isMaster: isMaster
          });

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
              { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['responsavel'] },
              { title: 'Meu Perfil', url: `/estudantes/${estId}`, icon: User, allowedRoles: ['responsavel'] },
              { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['responsavel'] },
              { title: 'Manual de Uso', url: '/manual-uso', icon: BookOpen, allowedRoles: ['responsavel'] },
              { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['responsavel'] }
            ]);
          } catch (e) {
            console.error('Erro ao buscar perfil de estudante:', e);
            setMenuItems([
              { title: 'Painel', url: '/painel', icon: LayoutDashboard, allowedRoles: ['responsavel'] },
              { title: 'Meu Perfil', url: `/estudantes/not-found`, icon: User, allowedRoles: ['responsavel'] },
              { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['responsavel'] },
              { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['responsavel'] }
            ]);
          }
        } else if (userRole) {
          const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(userRole));
          setMenuItems(accessibleItems);
        } else {
          setMenuItems([]);
        }

        // Atualiza snapshot para o caminho legacy
        savePermissionsSnapshot({
          role: userRole,
          escolaAtivaId: dbEscolaId,
          permittedEscolas: dbEscolas.length > 0 ? dbEscolas : (dbEscolaId ? [dbEscolaId] : []),
          availableProfiles: dbRoles,
          isMaster: isMaster
        });

      } catch (error) {
        console.error('Error fetching user role data:', error);
        // Em caso de erro (provavelmente offline), tentamos usar o snapshot uma última vez
        const snapshot = getInitialSnapshot(user.uid);
        if (snapshot && !role) {
          console.log("[useUserRole] Usando snapshot como fallback após erro de rede.");
          setRole(snapshot.role);
          setEscolaAtivaId(snapshot.escolaAtivaId);
          setPermittedEscolas(snapshot.permittedEscolas);
          setActiveProfileState(snapshot.activeProfile);
          setAvailableProfiles(snapshot.availableProfiles);
          
          const currentRole = snapshot.role;
          if (currentRole) {
            const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(currentRole));
            setMenuItems(accessibleItems);
          }
        }
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
