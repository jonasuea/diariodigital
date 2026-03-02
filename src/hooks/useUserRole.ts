import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
  { title: 'Professores', url: '/professores', icon: GraduationCap, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Equipe Gestora', url: '/equipe-gestora', icon: UserCog, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Turmas', url: '/turmas', icon: School, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Diário Digital', url: '/diario-digital', icon: BookOpen, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Relatórios', url: '/relatorios', icon: FileText, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Calendário', url: '/calendario', icon: Calendar, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante'] },
  { title: 'Usuários', url: '/usuarios', icon: UserCog, allowedRoles: ['admin'] },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [escolaAtivaId, setEscolaAtivaId] = useState<string | null>(null);
  const [permittedEscolas, setPermittedEscolas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setMenuItems([]);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'user_roles', user.uid);
        const userDoc = await getDoc(userDocRef);

        let userRole = null;
        let dbEscolaId = null;
        let dbEscolas: string[] = [];

        if (userDoc.exists()) {
          const data = userDoc.data();
          userRole = data.role;
          dbEscolaId = data.escola_id || null;
          dbEscolas = data.escolas || [];
        }

        setRole(userRole);

        // Se o usuário tiver array de escolas (professores em múltiplas escolas)
        if (dbEscolas.length > 0) {
          setPermittedEscolas(dbEscolas);
          const savedEscola = sessionStorage.getItem('escolaAtivaId');
          if (savedEscola && dbEscolas.includes(savedEscola)) {
            setEscolaAtivaId(savedEscola);
          } else {
            setEscolaAtivaId(dbEscolas[0]);
            sessionStorage.setItem('escolaAtivaId', dbEscolas[0]);
          }
        }
        // fallback para o campo antigo escola_id (gestores etc)
        else if (dbEscolaId && userRole !== 'admin') {
          setEscolaAtivaId(dbEscolaId);
          setPermittedEscolas([dbEscolaId]);
          sessionStorage.setItem('escolaAtivaId', dbEscolaId);
        }
        else if (userRole === 'admin') {
          setPermittedEscolas([]);
          // Se for admin, tenta pegar a última vista, senão null
          const savedEscola = sessionStorage.getItem('escolaAtivaId');
          if (savedEscola) {
            setEscolaAtivaId(savedEscola);
          }
        }

        if (userRole === 'estudante') {
          const q = query(collection(db, 'estudantes'), where('usuario_id', '==', user.uid));
          const snap = await getDocs(q);
          const estId = snap.empty ? 'not-found' : snap.docs[0].id;

          setMenuItems([
            { title: 'Meu Perfil', url: `/estudantes/${estId}`, icon: User, allowedRoles: ['estudante'] },
            { title: 'Calendário', url: '/calendario', icon: Calendar, allowedRoles: ['estudante'] }
          ]);
        } else if (userRole) {
          const accessibleItems = allMenuItems.filter(item => item.allowedRoles.includes(userRole));
          setMenuItems(accessibleItems);
        } else {
          setMenuItems([]);
        }

      } catch (error) {
        setRole(null);
        setMenuItems([]);
        return;
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isGestor = role === 'gestor';
  const isProfessor = role === 'professor';
  const isEstudante = role === 'estudante';

  return {
    role,
    escolaAtivaId,
    setEscolaAtivaId,
    loading,
    isAdmin,
    isGestor,
    isProfessor,
    isEstudante,
    permittedEscolas,
    menuItems
  };
}