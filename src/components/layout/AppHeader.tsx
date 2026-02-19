import { Search, Bell, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSidebar } from '@/components/ui/sidebar';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toggleSidebar, isMobile } = useSidebar();
  
  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const capitalize = (s: string | null) => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-6">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {title && (
        <h1 className="text-xl font-semibold text-foreground hidden sm:block">
          {title}
        </h1>
      )}

      <div className="flex-1" />

      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar..."
          className="w-64 pl-9 bg-secondary border-0"
        />
      </div>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
      </Button>

      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
            {user?.email ? getInitials(user.email) : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
            {user?.email}
          </p>
          <p className="text-xs text-muted-foreground">{capitalize(role)}</p>
        </div>
      </div>
    </header>
  );
}