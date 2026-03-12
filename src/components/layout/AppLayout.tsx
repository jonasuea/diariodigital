import { ReactNode } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { cn } from '@/lib/utils';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { useUserRole } from '@/hooks/useUserRole';
import { MaintenancePage } from '@/components/MaintenancePage';
import { MessagePopup } from '@/components/MessagePopup';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

function MainContent({ children, title }: AppLayoutProps) {
  const { open } = useSidebar();

  return (
    <div className={cn(
      "flex-1 flex flex-col min-w-0 transition-all duration-300",
      open ? "lg:pl-64" : "lg:pl-16"
    )}>
      <AppHeader title={title} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-hidden lg:overflow-x-auto">
        {children}
      </main>
    </div>
  );
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { config } = useSystemConfig();
  const { role } = useUserRole();

  // Show maintenance page to non-admins when system is in maintenance mode
  if (config.manutencao && role !== 'admin') {
    return <MaintenancePage message={config.manutencao_mensagem} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background/50">
        <AppSidebar />
        <MainContent title={title}>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}