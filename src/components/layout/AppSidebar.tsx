import { useState, useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
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
  LogOut,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Painel', url: '/painel', icon: LayoutDashboard },
  { title: 'Alunos', url: '/alunos', icon: Users },
  { title: 'Professores', url: '/professores', icon: GraduationCap },
  { title: 'Equipe Gestora', url: '/equipe-gestora', icon: UserCog },
  { title: 'Turmas', url: '/turmas', icon: School },
  { title: 'Diário Digital', url: '/diario-digital', icon: BookOpen },
  { title: 'Horário', url: '/horario', icon: Clock },
  { title: 'Relatórios', url: '/relatorios', icon: FileText },
  { title: 'Calendário', url: '/calendario', icon: Calendar },
  { title: 'Usuários', url: '/usuarios', icon: UserCog }, // Adicionado para admin
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { open, setOpen, isMobile, toggleSidebar, openMobile } = useSidebar();
  const [hovered, setHovered] = useState(false);

  const isExpanded = isMobile ? openMobile : open;

  const handleMouseEnter = () => {
    if (isMobile) {
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) {
      setHovered(false);
    }
  };

  return (
    <div
      className={`relative transition-all duration-300 ${isExpanded ? 'w-64' : 'w-16'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`fixed top-0 h-full bg-white shadow-lg z-40 transition-all duration-300 ${isExpanded ? 'w-64 left-0' : isMobile ? 'w-64 -left-64' : 'w-16 left-0'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            {isExpanded && (
              <span className="text-lg font-bold text-foreground whitespace-nowrap">
                EducaFácil
              </span>
            )}
          </div>
          {isMobile && isExpanded && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
              title="Fechar menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="px-3 py-4 scrollbar-thin bg-white flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 64px - 60px)' }}>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground/70 transition-all hover:bg-primary/10 hover:text-primary"
                activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span className="whitespace-nowrap">{item.title}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-3 bg-white">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-foreground/70 transition-all hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isExpanded && <span className="whitespace-nowrap">Sair</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
