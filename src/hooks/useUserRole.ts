import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
  { title: 'Estudantes', url: '/Estudantes', icon: Users, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Professores', url: '/professores', icon: GraduationCap, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Equipe Gestora', url: '/equipe-gestora', icon: UserCog, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
  { title: 'Turmas', url: '/turmas', icon: School, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Diário Digital', url: '/diario-digital', icon: BookOpen, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Horário', url: '/horario', icon: Clock, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor'] },
  { title: 'Relatórios', url: '/relatorios', icon: FileText, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario'] },
    { title: 'Calendário', url: '/calendario', icon: Calendar, allowedRoles: ['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante'] },
  { title: 'Usuários', url: '/usuarios', icon: UserCog, allowedRoles: ['admin'] },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, allowedRoles: ['admin'] },
];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
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
        const userRole = userDoc.exists() ? userDoc.data()?.role : null;
        
        setRole(userRole);

        if (userRole) {
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
    loading,
    isAdmin,
    isGestor,
    isProfessor,
    isEstudante,
    menuItems
  };
}