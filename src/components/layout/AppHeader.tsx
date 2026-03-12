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

          // Se não houver escola selecionada ainda, autoseleciona a primeira
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
    <header className="bg-secondary/50 backdrop-blur-sm border-b border-yellow-200/50 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 w-full">
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden text-primary hover:bg-primary/10 mr-1"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex flex-col">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-[#8B6508]/60 uppercase tracking-tight sm:tracking-widest leading-tight line-clamp-1 max-w-[120px] xs:max-w-none">
              Prefeitura de Itacoatiara – SEMED
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
          {(isAdmin || (permittedEscolas && permittedEscolas.length > 1)) && (
            <>
              {/* Desktop School Select */}
              <div className="w-[300px] lg:w-[400px] hidden lg:block mr-2">
                <Select
                  value={escolaAtivaId || undefined}
                  onValueChange={(val) => {
                    setEscolaAtivaId(val);
                    sessionStorage.setItem('escolaAtivaId', val);
                    window.location.reload(); // Força recarregamento contextual
                  }}
                >
                  <SelectTrigger className="h-9">
                    <div className="flex items-center gap-2 truncate">
                      <School className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {escolasDisponiveis.find(e => e.id === escolaAtivaId)?.nome || 'Selecione uma Escola'}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {escolasDisponiveis.map(esc => (
                      <SelectItem key={esc.id} value={esc.id}>{esc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:hidden mr-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9" title="Trocar Escola">
                      <School className="h-4 w-4 text-primary" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] rounded-lg">
                    <DialogHeader>
                      <DialogTitle>Trocar de Escola</DialogTitle>
                      <DialogDescription>
                        Selecione a unidade escolar que deseja acessar.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      {escolasDisponiveis.map(esc => (
                        <Button
                          key={esc.id}
                          variant={escolaAtivaId === esc.id ? "default" : "outline"}
                          className="justify-start h-12"
                          onClick={() => {
                            setEscolaAtivaId(esc.id);
                            sessionStorage.setItem('escolaAtivaId', esc.id);
                            window.location.reload();
                          }}
                        >
                          <School className="mr-2 h-4 w-4" />
                          <span className="truncate">{esc.nome}</span>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}

          {role !== 'estudante' && (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <div className="relative w-full sm:w-64 max-w-[100px] xs:max-w-[140px] sm:max-w-none md:max-w-[16rem] ml-1 sm:ml-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Busca..."
                    className="w-full pl-8 bg-white/60 border-yellow-100 focus-visible:ring-primary transition-all h-8 sm:h-9 text-xs sm:text-sm"
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
              <PopoverContent className="w-64 sm:w-80 p-0" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          )}

          <Button
            variant="ghost"
            size="icon"
            className="relative hidden sm:flex text-gray-500 hover:text-primary hover:bg-gray-100"
            onClick={() => navigate('/configuracoes')}
          >
            <Bell className="h-5 w-5" />
            {hasUpdate && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </Button>

          {/* Language Indicator GovBR */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 border-l border-yellow-200/30">
            <Globe className="w-4 h-4 text-[#8B6508]/40" />
            <span className="text-xs font-bold text-[#8B6508]/60">PT-BR</span>
          </div>

          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l sm:border-yellow-200/30">
            <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border border-yellow-200/50 shadow-sm shrink-0">
              <AvatarImage src={userProfile?.foto_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-sm font-bold">
                {getInitials(userProfile?.nome || user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block mr-2">
              <p className="text-sm font-bold text-[#8B6508] truncate max-w-[120px]">
                {userProfile?.nome || user?.email}
              </p>
              <p className="text-[10px] font-semibold text-[#8B6508]/60 uppercase tracking-wider">{capitalize(role)}</p>
            </div>

            <button
              onClick={handleLogout}
              className="font-body font-semibold text-[#8B6508]/70 hover:text-primary hover:bg-yellow-50 px-3 py-1.5 rounded transition-colors text-sm items-center gap-2 hidden lg:flex"
            >
              Sair
            </button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="lg:hidden text-[#8B6508]/60 hover:text-primary">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header >
  );
}