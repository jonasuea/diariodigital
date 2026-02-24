import { Search, Bell, Menu, User, School, Briefcase, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSidebar } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title?: string;
}

interface SearchResult {
  id: string;
  nome: string;
  tipo: 'estudante' | 'professor' | 'gestor';
  foto_url?: string;
  matricula?: string;
  email?: string;
}

interface UserProfile {
  nome: string;
  foto_url?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toggleSidebar, isMobile } = useSidebar();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    async function fetchProfile() {
      if (!user || !role || role === 'pending') {
        setUserProfile({ nome: user?.email || 'Usuário', foto_url: user?.photoURL || undefined });
        return;
      }

      try {
        let profileData: UserProfile | null = null;

        if (['gestor', 'pedagogo', 'secretario', 'professor'].includes(role)) {
            const collectionName = role === 'professor' ? 'professores' : 'equipe_gestora';
            const q = query(collection(db, collectionName), where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data();
              profileData = {
                nome: data.nome,
                foto_url: data.foto_url || undefined,
              };
            }
        }

        if (!profileData) {
            const profileDocRef = doc(db, 'profiles', user.uid);
            const profileDoc = await getDoc(profileDocRef);
            if (profileDoc.exists()) {
              const data = profileDoc.data();
              profileData = { nome: data.nome, foto_url: data.foto_url || undefined };
            }
        }
        
        setUserProfile(profileData || { nome: user.displayName || user.email || 'Usuário', foto_url: user.photoURL || undefined });
      } catch (error) {
        console.error("Erro ao carregar perfil no header:", error);
        setUserProfile({ nome: user.displayName || user.email || 'Usuário', foto_url: user.photoURL || undefined });
      }
    }

    fetchProfile();
  }, [user, role]);

  useEffect(() => {
    async function performSearch() {
      if (debouncedSearchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);

      const searchLower = debouncedSearchQuery.toLowerCase();
      
      try {
        const [estudantesSnap, profsSnap, gestoresSnap] = await Promise.all([
          getDocs(query(collection(db, 'estudantes'), where('nome_lower', '>=', searchLower), where('nome_lower', '<=', searchLower + '\uf8ff'), limit(5))),
          getDocs(query(collection(db, 'professores'), where('nome_lower', '>=', searchLower), where('nome_lower', '<=', searchLower + '\uf8ff'), limit(5))),
          getDocs(query(collection(db, 'equipe-gestora'), where('nome_lower', '>=', searchLower), where('nome_lower', '<=', searchLower + '\uf8ff'), limit(5)))
        ]);

        const results: SearchResult[] = [];
        estudantesSnap.forEach(doc => results.push({ id: doc.id, ...doc.data(), tipo: 'estudante' } as SearchResult));
        profsSnap.forEach(doc => results.push({ id: doc.id, ...doc.data(), tipo: 'professor' } as SearchResult));
        gestoresSnap.forEach(doc => results.push({ id: doc.id, ...doc.data(), tipo: 'gestor' } as SearchResult));

        setSearchResults(results);
      } catch (error) {
        console.error("Erro na busca:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }

    performSearch();
  }, [debouncedSearchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 1 && !isPopoverOpen) {
      setIsPopoverOpen(true);
    } else if (query.length <= 1 && isPopoverOpen) {
      setIsPopoverOpen(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setIsPopoverOpen(false);

    switch (result.tipo) {
      case 'estudante':
        navigate(`/Estudantes/${result.id}`);
        break;
      case 'professor':
        navigate(`/professores/${result.id}`);
        break;
      case 'gestor':
        navigate(`/equipe-gestora/${result.id}`);
        break;
    }
  };

  const getTipoIcon = (tipo: SearchResult['tipo']) => {
    switch (tipo) {
      case 'estudante': return <User className="h-4 w-4 text-muted-foreground" />;
      case 'professor': return <School className="h-4 w-4 text-muted-foreground" />;
      case 'gestor': return <Briefcase className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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

      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar pessoas..."
              className="w-40 sm:w-64 lg:w-[32rem] pl-9 bg-secondary border-0 transition-all"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.length > 1) {
                  setIsPopoverOpen(true);
                }
              }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-40 sm:w-64 lg:w-[32rem] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          {isSearching ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map(result => (
                <div 
                  key={result.id} 
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                  onClick={() => handleResultClick(result)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={result.foto_url} />
                    <AvatarFallback>{result.nome.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">{result.tipo}</p>
                  </div>
                  {getTipoIcon(result.tipo)}
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-center text-muted-foreground">
              {debouncedSearchQuery.length > 1 ? 'Nenhum resultado encontrado.' : 'Digite para buscar...'}
            </p>
          )}
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
      </Button>

      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={userProfile?.foto_url} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
            {getInitials(userProfile?.nome || user?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
            {userProfile?.nome || user?.email}
          </p>
          <p className="text-xs text-muted-foreground">{capitalize(role)}</p>
        </div>
      </div>
    </header>
  );
}