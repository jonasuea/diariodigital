import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CalendarDays,
  BarChart2,
  Settings,
  MessageSquare,
  Clock,
  FileText,
  GraduationCap,
  Users,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserRole } from '@/hooks/useUserRole';

interface PersonResult {
  id: string;
  nome: string;
  tipo: 'estudante' | 'professor';
  foto_url?: string;
  matricula?: string;
  email?: string;
}

// Rotas do Diário Digital (professor-focused)
const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/painel', shortcut: 'G D' },
  { label: 'Turmas', icon: BookOpen, path: '/turmas', shortcut: 'G T' },
  { label: 'Diário Digital', icon: ClipboardList, path: '/diario-digital', shortcut: 'G Di' },
  { label: 'Horário', icon: Clock, path: '/horario' },
  { label: 'Calendário', icon: CalendarDays, path: '/calendario' },
  { label: 'Mensagens', icon: MessageSquare, path: '/mensagens' },
  { label: 'Manual de Uso', icon: FileText, path: '/manual-uso' },
  { label: 'Configurações', icon: Settings, path: '/configuracoes', shortcut: 'G C' },
];

const TIPO_LABEL: Record<PersonResult['tipo'], string> = {
  estudante: 'Estudante',
  professor: 'Professor',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { role } = useUserRole();

  const debouncedInput = useDebounce(inputValue, 280);

  // ── Global keyboard shortcut (Ctrl+K / ⌘K) ───────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setInputValue('');
      setPersonResults([]);
    }
  }, [open]);

  // ── Firestore search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (debouncedInput.length < 2) {
      setPersonResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const searchLower = debouncedInput.toLowerCase();

    (async () => {
      try {
        const [estudantesSnap, profsSnap] = await Promise.all([
          getDocs(query(collection(db, 'estudantes'), where('nome_lower', '>=', searchLower), where('nome_lower', '<=', searchLower + '\uf8ff'), limit(5))),
          getDocs(query(collection(db, 'professores'), where('nome_lower', '>=', searchLower), where('nome_lower', '<=', searchLower + '\uf8ff'), limit(4))),
        ]);

        if (cancelled) return;

        const results: PersonResult[] = [];
        estudantesSnap.forEach(d => results.push({ id: d.id, ...d.data(), tipo: 'estudante' } as PersonResult));
        profsSnap.forEach(d => results.push({ id: d.id, ...d.data(), tipo: 'professor' } as PersonResult));

        setPersonResults(results);
      } catch {
        if (!cancelled) setPersonResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedInput]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePersonSelect = useCallback((result: PersonResult) => {
    setOpen(false);
    switch (result.tipo) {
      case 'estudante': navigate(`/estudantes/${result.id}`); break;
      case 'professor': navigate(`/professores/${result.id}`); break;
    }
  }, [navigate]);

  const handleNavSelect = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  // Filter nav items to those the current role can access
  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.path === '/configuracoes') return role === 'admin' || role === 'gestor';
    return true;
  }).filter(item =>
    !inputValue ||
    item.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="[&>[cmdk-input-wrapper]]:border-b-border">
        <CommandInput
          placeholder="Buscar turmas, alunos, páginas..."
          value={inputValue}
          onValueChange={setInputValue}
          className="h-12 text-sm"
        />
      </div>

      <CommandList className="max-h-[420px]">
        {/* ── Person search results ───────────────────────────────────────── */}
        {debouncedInput.length >= 2 && (
          <>
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : personResults.length > 0 ? (
              <CommandGroup heading="Pessoas">
                {personResults.map(result => (
                  <CommandItem
                    key={`${result.tipo}-${result.id}`}
                    value={`${result.nome} ${result.tipo}`}
                    onSelect={() => handlePersonSelect(result)}
                    className="gap-3 py-2.5"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={result.foto_url} alt={result.nome} />
                      <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                        {result.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.nome}</p>
                      <p className="text-xs text-muted-foreground">{TIPO_LABEL[result.tipo]}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            )}

            {filteredNavItems.length > 0 && <CommandSeparator />}
          </>
        )}

        {/* ── Navigation items ────────────────────────────────────────────── */}
        {filteredNavItems.length > 0 && (
          <CommandGroup heading={debouncedInput.length >= 2 ? 'Páginas' : 'Navegação Rápida'}>
            {filteredNavItems.map(item => (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => handleNavSelect(item.path)}
                className="gap-3 py-2.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/50 shrink-0">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm">{item.label}</span>
                {item.shortcut && (
                  <CommandShortcut className="text-[11px] tracking-wider">{item.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ── Empty fallback ──────────────────────────────────────────────── */}
        {!isSearching && filteredNavItems.length === 0 && personResults.length === 0 && debouncedInput.length >= 2 && (
          <CommandEmpty>Nenhum resultado para "{debouncedInput}".</CommandEmpty>
        )}

        {/* ── Hint footer ─────────────────────────────────────────────────── */}
        <div className="border-t px-4 py-2.5 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd> abrir</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> fechar</span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
