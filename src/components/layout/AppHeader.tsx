import { Search, Bell, Menu, User, School, Briefcase, Loader2, LogOut, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSidebar } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { collection, query, where, getDocs, limit, doc, getDoc, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SyncStatus } from '@/components/SyncStatus';
import { PWAInstallButton } from '@/components/PWAInstallButton';

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
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { role, escolaAtivaId, setEscolaAtivaId, isAdmin, permittedEscolas } = useUserRole();
  const { toggleSidebar, isMobile } = useSidebar();
  const navigate = useNavigate();
  const { hasUpdate } = useAutoUpdate();

  const [escolasDisponiveis, setEscolasDisponiveis] = useState<{ id: string, nome: string }[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    async function loadEscolas() {
      if (isAdmin || (permittedEscolas && permittedEscolas.length > 1)) {
        try {
          let escolasQuery;
          if (isAdmin) {
            escolasQuery = query(collection(db, 'escolas'), limit(50));
          } else {
            escolasQuery = query(collection(db, 'escolas'), where(documentId(), 'in', permittedEscolas), limit(50));
          }

          const escolasSnap = await getDocs(escolasQuery);
          const lista = escolasSnap.docs.map(doc => ({ id: doc.id, nome: (doc.data() as any).nome }));
          setEscolasDisponiveis(lista);

          if (!escolaAtivaId && lista.length > 0) {
            setEscolaAtivaId(lista[0].id);
            sessionStorage.setItem('escolaAtivaId', lista[0].id);
          }
        } catch (error) {
          console.error("Sem permissão para carregar escolas no header:", error);
        }
      } else {
        setEscolasDisponiveis([]);
      }
    }
    loadEscolas();
  }, [isAdmin, permittedEscolas, escolaAtivaId, setEscolaAtivaId]);

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
          const q = query(collection(db, collectionName), where('email', '==', user.email), limit(1));
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
        console.error("Sem permissão para carregar perfil no header:", error);
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

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 transition-all">
      <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-brand-blue/60 hover:text-brand-blue hover:bg-brand-blue/5 rounded-xl transition-colors lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {(isAdmin || (permittedEscolas && permittedEscolas.length > 1)) && (
            <div className="flex items-center gap-2">
              <div className="w-[180px] xs:w-[220px] sm:w-[280px] lg:w-[320px] hidden md:block group">
                <Select
                  value={escolaAtivaId || ""}
                  onValueChange={(val) => {
                    setEscolaAtivaId(val);
                    sessionStorage.setItem('escolaAtivaId', val);
                    window.location.href = '/painel';
                  }}
                >
                  <SelectTrigger className="h-10 border-gray-200/60 bg-white/50 hover:bg-white hover:border-brand-blue/30 hover:shadow-soft transition-all rounded-xl ring-offset-background focus:ring-1 focus:ring-brand-blue px-3">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="h-7 w-7 rounded-lg bg-brand-blue items-center justify-center hidden sm:flex flex-shrink-0 transition-transform group-hover:scale-105">
                        <School className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="truncate font-semibold text-gray-700 text-sm">
                        {escolasDisponiveis.find(e => e.id === escolaAtivaId)?.nome || t('header.selectSchool')}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-100 shadow-xl p-1">
                    {escolasDisponiveis.map(esc => (
                      <SelectItem key={esc.id} value={esc.id} className="rounded-lg py-2.5 focus:bg-brand-blue/5 focus:text-brand-blue transition-colors cursor-pointer">
                        {esc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:hidden">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 border-gray-200/60 rounded-xl hover:bg-brand-blue/5 hover:text-brand-blue hover:border-brand-blue/30" title={t('header.changeSchool')}>
                      <School className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] rounded-2xl p-4 sm:p-6 gallery-scrollbar">
                    <DialogHeader className="mb-4">
                      <DialogTitle className="text-xl font-bold text-brand-blue">{t('header.changeSchoolTitle')}</DialogTitle>
                      <DialogDescription className="text-sm">
                        {t('header.changeSchoolDesc')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 overflow-y-auto max-h-[60vh] pr-1">
                      {escolasDisponiveis.map(esc => (
                        <Button
                          key={esc.id}
                          variant={escolaAtivaId === esc.id ? "default" : "outline"}
                          className={`justify-start h-14 px-4 rounded-xl transition-all border-gray-200/60 ${
                            escolaAtivaId === esc.id 
                            ? "bg-brand-blue hover:bg-brand-blue/90 shadow-soft-lg" 
                            : "hover:bg-brand-blue/5 hover:text-brand-blue hover:border-brand-blue/20"
                          }`}
                          onClick={() => {
                            setEscolaAtivaId(esc.id);
                            sessionStorage.setItem('escolaAtivaId', esc.id);
                            window.location.href = '/painel';
                          }}
                        >
                          <School className={`mr-3 h-5 w-5 ${escolaAtivaId === esc.id ? "text-white" : "text-brand-blue/60"}`} />
                          <span className="truncate font-semibold text-base">{esc.nome}</span>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
          {role !== 'estudante' && (
            <div className="relative w-full sm:w-64 max-w-[100px] xs:max-w-[140px] sm:max-w-none md:max-w-[16rem] ml-1 sm:ml-2 group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-brand-blue" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="w-full pl-9 pr-16 bg-gray-100/50 hover:bg-gray-100/80 border-transparent focus-visible:ring-brand-blue/30 focus:bg-white focus:border-brand-blue/20 transition-all h-10 rounded-xl text-sm cursor-pointer shadow-none hover:shadow-soft"
                readOnly
                onClick={() => {
                  const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                  document.dispatchEvent(ev);
                }}
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center h-5 select-none gap-1 rounded border border-gray-300/60 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-gray-500 opacity-100 shadow-sm">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-3">
            <SyncStatus />
            <div className="h-4 w-[1px] bg-gray-200" />
            <LanguageSelector />
          </div>

          <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-gray-200/50">
            <div className="flex items-center gap-2.5 group cursor-pointer p-0.5 pr-2 rounded-xl hover:bg-gray-50 transition-colors lg:flex hidden">
              <Avatar className="h-9 w-9 border-2 border-white shadow-soft ring-1 ring-gray-100 transition-transform group-hover:scale-105">
                <AvatarImage src={userProfile?.foto_url} />
                <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-sm font-bold">
                  {getInitials(userProfile?.nome || user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left">
                <p className="text-sm font-bold text-gray-900 truncate max-w-[140px] leading-tight group-hover:text-brand-blue transition-colors">
                  {userProfile?.nome || user?.email}
                </p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-brand-blue/60 uppercase tracking-widest">{t(`roles.${role}`, role)}</span>
                  {isAdmin && <span className="h-1 w-1 rounded-full bg-brand-blue/30" />}
                </div>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              className="rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex group"
              title={t('common.logout')}
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}