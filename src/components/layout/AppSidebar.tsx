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
      <div className={`fixed top-0 h-full bg-white shadow-xl z-40 transition-all duration-300 flex flex-col border-r border-gray-100 ${isExpanded ? 'w-64 left-0' : isMobile ? 'w-64 -left-64' : 'w-16 left-0'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue shadow-soft shadow-brand-blue/30 flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            {isExpanded && (
              <span className="text-lg font-bold text-brand-blue whitespace-nowrap tracking-tight">
                Diário Digital
                <div className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-brand-blue/60 uppercase tracking-tight sm:tracking-widest leading-tight line-clamp-1 max-w-[120px] xs:max-w-none">
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
              className="h-8 w-8 text-brand-blue/60 hover:text-brand-blue hover:bg-brand-blue/5 flex-shrink-0 rounded-lg"
              title="Fechar menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="px-3 py-4 scrollbar-thin bg-white flex-1 overflow-y-auto min-h-0">
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-brand-blue/70 transition-all duration-200 hover:bg-brand-blue/5 hover:text-brand-blue shadow-none mb-1 group"
                activeClassName="bg-brand-blue text-white font-semibold shadow-soft shadow-brand-blue/30 hover:bg-brand-blue hover:text-white group"
              >
                <item.icon className="h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110" />
                {isExpanded && <span className="whitespace-nowrap font-medium">{t(`menu.${item.title}`, item.title)}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-gray-100 p-3 bg-white space-y-2">
          {!isMobile && (
            <PWAInstallButton
              className="w-full justify-start border-none bg-brand-blue/5 hover:bg-brand-blue/10 text-brand-blue rounded-xl font-semibold transition-all"
              showIconOnly={!isExpanded}
            />
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-red-500/80 font-semibold transition-all hover:bg-red-50 hover:text-red-600 group"
          >
            <LogOut className="h-5 w-5 flex-shrink-0 transition-transform group-hover:-translate-x-1" />
            {isExpanded && <span className="whitespace-nowrap">{t('common.logout')}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

