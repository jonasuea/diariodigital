import { useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import {
  GraduationCap,
  LogOut,
  PanelLeftClose,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { Download } from 'lucide-react';

export function AppSidebar() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { open, setOpen, isMobile, toggleSidebar, openMobile } = useSidebar();
  const { menuItems } = useUserRole();
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
      className="relative w-0 transition-all duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`fixed top-0 h-full bg-sidebar-background shadow-lg z-40 transition-all duration-300 flex flex-col ${isExpanded ? 'w-64 left-0' : isMobile ? 'w-64 -left-64' : 'w-16 left-0'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border bg-sidebar-background">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            {isExpanded && (
              <span className="text-lg font-bold text-sidebar-primary whitespace-nowrap">
                Diário Digital
                <div className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight sm:tracking-widest leading-tight line-clamp-1 max-w-[120px] xs:max-w-none">
                  {t('header.prefeitura')}
                </div>
              </span>
            )}
          </div>
          {isMobile && isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground flex-shrink-0"
              title="Fechar menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="px-3 py-4 scrollbar-thin bg-sidebar-background flex-1 overflow-y-auto min-h-0">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                onClick={() => {
                  if (isMobile && openMobile) {
                    toggleSidebar();
                  }
                  if (!item.url.startsWith('/diario-digital')) {
                    sessionStorage.removeItem('diario_filtros');
                  }
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-sidebar-accent/40 text-sidebar-foreground font-medium transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shadow-sm mb-1"
                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-md hover:bg-sidebar-primary hover:text-sidebar-primary-foreground scale-[1.02]"
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span className="whitespace-nowrap">{t(`menu.${item.title}`, item.title)}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-sidebar-border p-3 bg-sidebar-background space-y-2">
          {!isMobile && (
            <PWAInstallButton 
              className="w-full justify-start border-none bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground" 
              showIconOnly={!isExpanded} 
            />
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 bg-sidebar-accent/40 text-sidebar-foreground font-medium transition-all hover:bg-destructive hover:text-destructive-foreground shadow-sm"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isExpanded && <span className="whitespace-nowrap">{t('common.logout')}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
