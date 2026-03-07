import { ReactNode } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

function MainContent({ children, title }: AppLayoutProps) {
  const { open, isMobile } = useSidebar();
  const paddingClass = isMobile ? 'pl-0' : open ? 'pl-64' : 'pl-16';

  return (
    <div className={`flex-1 flex flex-col transition-all duration-300 ${paddingClass}`}>
      <AppHeader title={title} />
      <main className="flex-1 p-4 md:p-6 overflow-auto" style={{ overflowX: 'clip' }}>
        {children}
      </main>
    </div>
  );
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <MainContent title={title}>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}