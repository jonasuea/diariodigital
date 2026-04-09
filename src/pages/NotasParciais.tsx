import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Send, Search, ClipboardList, Link as LinkIcon, Unlink, Info, Check, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, doc, updateDoc,
    addDoc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Estudante { id: string; nome: string; matricula: string; }

interface ComponenteTurma { nome: string; professorId: string; professorNome?: string; }

interface Turma {
    id: string;
    nome: string;
    serie?: string;
    componentes?: ComponenteTurma[];
}

interface NotaParcial {
    id?: string;        // Firestore doc id
    av1: number | string | null;
    av2: number | string | null;
    av3: number | string | null;
    av4: number | string | null;
    media: number | null;
}

// Record: estudanteId → NotaParcial
type NotasPorEstudante = Record<string, NotaParcial>;

// All bimesters: 1-4 → NotasPorEstudante
type NotasState = Record<number, NotasPorEstudante>;

interface AvaliacaoVinculo {
    id: string;
    titulo: string;
    data: string;
    valor?: string;
}

// Map: bimestre -> (avSlot -> AvaliacaoVinculo)
type AvaliacoesLinks = Record<number, Record<string, AvaliacaoVinculo | null>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BIMESTRES = [1, 2, 3, 4] as const;
const BIMESTRE_LABELS: Record<number, string> = {
    1: '1º Bimestre', 2: '2º Bimestre', 3: '3º Bimestre', 4: '4º Bimestre',
};
const BIMESTRE_COLORS: Record<number, string> = {
    1: 'bg-blue-50 border-blue-200',
    2: 'bg-purple-50 border-purple-200',
    3: 'bg-emerald-50 border-emerald-200',
    4: 'bg-orange-50 border-orange-200',
};
const BIMESTRE_HEADER: Record<number, string> = {
    1: 'bg-blue-100 text-blue-900',
    2: 'bg-purple-100 text-purple-900',
    3: 'bg-emerald-100 text-emerald-900',
    4: 'bg-orange-100 text-orange-900',
};

function parseNotaStr(v: number | string | null | undefined): number | null {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const n = parseFloat(v.toString().replace(',', '.'));
    return isNaN(n) ? null : n;
}

function calcMedia(n: NotaParcial): number | null {
    const vals = [n.av1, n.av2, n.av3, n.av4].map(parseNotaStr).filter(v => v != null) as number[];
    if (vals.length === 0) return null;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(m * 10) / 10;
}

function fmtN(v: number | string | null | undefined): string {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    return v.toFixed(1);
}

function getNotaColor(v: number | null): string {
    if (v == null) return '';
    if (v >= 7) return 'text-green-700 font-semibold';
    if (v >= 5) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
}

function maskNota(raw: string): string {
    const v = raw.replace(/\D/g, '');
    if (v === '') return '';

    if (v.length === 1) {
        return parseInt(v, 10).toString();
    }

    const intValStr = v.slice(0, -1);
    const decVal = v.slice(-1);
    const intVal = parseInt(intValStr, 10).toString();

    const finalStr = `${intVal}.${decVal}`;
    if (parseFloat(finalStr) > 10) return '10.0';
    return finalStr;
}

const emptyNota = (): NotaParcial => ({ av1: null, av2: null, av3: null, av4: null, media: null });

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotasParciais() {
    const navigate = useNavigate();
    const { turmaId } = useParams<{ turmaId: string }>();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [turma, setTurma] = useState<Turma | null>(null);
    const [estudantes, setEstudantes] = useState<Estudante[]>([]);
    const [componente, setComponente] = useState<string>(searchParams.get('componente') || '');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [unlocking, setUnlocking] = useState<number | null>(null);
    const [bimestresLocked, setBimestresLocked] = useState<Set<number>>(new Set());
    const [avaliacoesLinks, setAvaliacoesLinks] = useState<AvaliacoesLinks>({ 1: {}, 2: {}, 3: {}, 4: {} });

    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [currentLinkBimestre, setCurrentLinkBimestre] = useState<number | null>(null);
    const [currentLinkSlot, setCurrentLinkSlot] = useState<string | null>(null);
    const [avaliacoesList, setAvaliacoesList] = useState<AvaliacaoVinculo[]>([]);
    const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false);

    const { role, escolaAtivaId } = useUserRole();
    const ROLES_GESTAO_DESBLOQUEIO = ['admin', 'gestor', 'secretario'];
    const ROLES_EDICAO = ['admin', 'professor'];
    const podeDesbloquear = role ? ROLES_GESTAO_DESBLOQUEIO.includes(role) : false;
    const podeEditar = role ? ROLES_EDICAO.includes(role) : false;
    const isProfessor = role === 'professor';

    // notas[bimestre][estudanteId] = NotaParcial
    const [notas, setNotas] = useState<NotasState>({ 1: {}, 2: {}, 3: {}, 4: {} });

    const isComponenteFixo = searchParams.get('origem') === 'diario';
    const ano = new Date().getFullYear();
    const componentesDaTurma = turma?.componentes?.filter(c => c.professorId) || [];

    // ── Config key ────────────────────────────────────────────────────────────
    const configId = turmaId && componente
        ? `${turmaId}_${componente.replace(/[^a-zA-Z0-9]/g, '_')}_${ano}`
        : null;

    async function loadConfig() {
        if (!configId) return;
        try {
            const snap = await getDoc(doc(db, 'notas_parciais_config', configId));
            if (snap.exists()) {
                const data = snap.data();
                const locked: number[] = data?.bimestres_bloqueados || [];
                setBimestresLocked(new Set(locked));

                // Carrega os vínculos de avaliações
                const links = data?.links || {};
                const parsedLinks: AvaliacoesLinks = { 1: {}, 2: {}, 3: {}, 4: {} };
                [1, 2, 3, 4].forEach(b => {
                    parsedLinks[b] = links[b] || {};
                });
                setAvaliacoesLinks(parsedLinks);
            } else {
                // Sem config salva: todos os bimestres começam DESBLOQUEADOS
                setBimestresLocked(new Set());
                setAvaliacoesLinks({ 1: {}, 2: {}, 3: {}, 4: {} });
            }
        } catch (err) {
            console.warn('Erro ao carregar config de bloqueio:', err);
        }
    }

    async function saveConfig(locked: Set<number>, links?: AvaliacoesLinks) {
        if (!configId) return;
        try {
            const payload: any = {
                turma_id: turmaId,
                escola_id: escolaAtivaId,
                escola_ids: [escolaAtivaId],
                componente,
                ano,
                bimestres_bloqueados: Array.from(locked),
            };

            if (links) {
                payload.links = links;
            } else {
                payload.links = avaliacoesLinks;
            }

            await setDoc(doc(db, 'notas_parciais_config', configId), payload, { merge: true });
        } catch (err) {
            console.warn('Sem permissão para salvar config de bloqueio:', err);
        }
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        if (!turmaId || !escolaAtivaId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const turmaSnap = await getDoc(doc(db, 'turmas', turmaId));
            if (!turmaSnap.exists()) { toast.error('Turma não encontrada'); navigate(-1); return; }
            const turmaData = { id: turmaSnap.id, ...turmaSnap.data() } as Turma;
            setTurma(turmaData);

            const estudantesSnap = await getDocs(
                query(collection(db, 'estudantes'), where('escola_id', '==', escolaAtivaId), where('turma_id', '==', turmaId))
            );
            const lista = estudantesSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as Estudante))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            setEstudantes(lista);
        } catch (err) {
            toast.error('Sem permissão para carregar dados');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [turmaId, navigate, escolaAtivaId]);

    const loadNotasParciais = useCallback(async () => {
        if (!turmaId || !componente || estudantes.length === 0 || !escolaAtivaId) return;

        try {
            const snap = await getDocs(
                query(
                    collection(db, 'notas_parciais'),
                    where('escola_id', '==', escolaAtivaId),
                    where('turma_id', '==', turmaId),
                    where('componente', '==', componente),
                    where('ano', '==', ano),
                )
            );

            const newNotas: NotasState = { 1: {}, 2: {}, 3: {}, 4: {} };
            // Initialize empty entries for all students
            estudantes.forEach(e => {
                BIMESTRES.forEach(b => {
                    newNotas[b][e.id] = emptyNota();
                });
            });

            snap.docs.forEach(d => {
                const data = d.data();
                const bim: number = data.bimestre;
                const eid: string = data.estudante_id;
                if (newNotas[bim] && eid) {
                    newNotas[bim][eid] = {
                        id: d.id,
                        av1: data.av1 ?? null,
                        av2: data.av2 ?? null,
                        av3: data.av3 ?? null,
                        av4: data.av4 ?? null,
                        media: data.media ?? null,
                    };
                }
            });

            setNotas(newNotas);
        } catch (err) {
            console.error('Sem permissão para carregar notas parciais:', err);
        }
    }, [turmaId, componente, ano, estudantes, escolaAtivaId]);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { loadNotasParciais(); }, [loadNotasParciais]);
    // Recarrega config de bloqueio sempre que componente ou turma mudam
    useEffect(() => { loadConfig(); }, [configId]);


    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleAvChange(bim: number, estudanteId: string, field: keyof Pick<NotaParcial, 'av1' | 'av2' | 'av3' | 'av4'>, raw: string) {
        const masked = maskNota(raw);
        setNotas(prev => {
            const nota = { ...prev[bim][estudanteId] };
            (nota as any)[field] = masked;
            nota.media = calcMedia(nota);
            return { ...prev, [bim]: { ...prev[bim], [estudanteId]: nota } };
        });
    }

    function handleAvBlur(bim: number, estudanteId: string, field: keyof Pick<NotaParcial, 'av1' | 'av2' | 'av3' | 'av4'>) {
        setNotas(prev => {
            const nota = { ...prev[bim][estudanteId] };
            let val = (nota as any)[field];
            if (val !== null && val !== '') {
                let parsed = parseFloat(val);
                if (!isNaN(parsed)) {
                    (nota as any)[field] = parsed.toFixed(1);
                }
            }
            return { ...prev, [bim]: { ...prev[bim], [estudanteId]: nota } };
        });
    }

    async function handleSaveBimestre(bim: number) {
        if (!turmaId || !componente) {
            toast.error('Selecione um componente curricular antes de salvar.');
            return;
        }
        setSaving(bim);
        try {
            const notasBim = notas[bim];
            await Promise.all(
                Object.entries(notasBim).map(async ([estudanteId, nota]) => {
                    const media = calcMedia(nota);
                    const payload = {
                        turma_id: turmaId,
                        escola_id: escolaAtivaId,
                        escola_ids: [escolaAtivaId],
                        componente,
                        ano,
                        bimestre: bim,
                        estudante_id: estudanteId,
                        av1: parseNotaStr(nota.av1),
                        av2: parseNotaStr(nota.av2),
                        av3: parseNotaStr(nota.av3),
                        av4: parseNotaStr(nota.av4),
                        media,
                        updated_at: serverTimestamp(),
                    };
                    if (nota.id) {
                        await updateDoc(doc(db, 'notas_parciais', nota.id), payload);
                    } else {
                        const hasData = parseNotaStr(nota.av1) != null || parseNotaStr(nota.av2) != null || parseNotaStr(nota.av3) != null || parseNotaStr(nota.av4) != null;
                        if (hasData) {
                            const ref = await addDoc(collection(db, 'notas_parciais'), { ...payload, created_at: serverTimestamp() });
                            // update local id
                            setNotas(prev => ({
                                ...prev,
                                [bim]: { ...prev[bim], [estudanteId]: { ...nota, id: ref.id, media } },
                            }));
                        }
                    }
                })
            );
            await logActivity(`salvou notas parciais do ${bim}º bimestre de "${componente}" — turma "${turma?.nome}".`);
            toast.success(`Notas do ${bim}º bimestre salvas!`);
        } catch (err) {
            toast.error('Sem permissão para salvar notas parciais.');
            console.error(err);
        } finally {
            setSaving(null);
        }
    }

    async function handleSyncToNotas(bim: number) {
        if (!turmaId || !componente) {
            toast.error('Selecione um componente curricular.');
            return;
        }
        setSyncing(bim);
        try {
            const notasBim = notas[bim];
            const bimestreField = `bimestre_${bim}` as 'bimestre_1' | 'bimestre_2' | 'bimestre_3' | 'bimestre_4';

            await Promise.all(
                Object.entries(notasBim).map(async ([estudanteId, notaParcial]) => {
                    const media = calcMedia(notaParcial);
                    if (media == null) return; // nothing to sync

                    // Find existing nota document
                    const notasSnap = await getDocs(
                        query(
                            collection(db, 'notas'),
                            where('escola_id', '==', escolaAtivaId),
                            where('estudante_id', '==', estudanteId),
                            where('turma_id', '==', turmaId),
                            where('componente', '==', componente),
                            where('ano', '==', ano),
                        )
                    );

                    if (!notasSnap.empty) {
                        await updateDoc(doc(db, 'notas', notasSnap.docs[0].id), { [bimestreField]: media });
                    } else {
                        // Create new nota document
                        await addDoc(collection(db, 'notas'), {
                            estudante_id: estudanteId,
                            turma_id: turmaId,
                            escola_id: escolaAtivaId,
                            escola_ids: [escolaAtivaId],
                            componente,
                            ano,
                            bimestre_1: bim === 1 ? media : null,
                            bimestre_2: bim === 2 ? media : null,
                            bimestre_3: bim === 3 ? media : null,
                            bimestre_4: bim === 4 ? media : null,
                        });
                    }
                })
            );
            await logActivity(`enviou média parcial do ${bim}º bimestre de "${componente}" para o registro de notas.`);
            toast.success(`Médias do ${bim}º bimestre enviadas para Notas!`);

            // Bloqueia o bimestre após envio
            const novoLocked = new Set(bimestresLocked).add(bim);
            setBimestresLocked(novoLocked);
            await saveConfig(novoLocked);
            toast.info(`${bim}º bimestre bloqueado para edição. Secretário, Gestor ou Admin podem reabilitar.`);

        } catch (err) {
            toast.error('Sem permissão para enviar médias para Notas.');
            console.error(err);
        } finally {
            setSyncing(null);
        }
    }

    async function handleUnlock(bim: number) {
        if (!podeDesbloquear) return;
        setUnlocking(bim);
        try {
            const novoLocked = new Set(bimestresLocked);
            novoLocked.delete(bim);
            setBimestresLocked(novoLocked);
            await saveConfig(novoLocked);
            await logActivity(`habilitou edição do ${bim}º bimestre de "${componente}" — turma "${turma?.nome}".`);
            toast.success(`${bim}º bimestre desbloqueado para edição.`);
        } catch (err) {
            toast.error('Sem permissão para desbloquear bimestre.');
            console.error(err);
        } finally {
            setUnlocking(null);
        }
    }

    const openLinkDialog = async (bim: number, slot: string) => {
        if (bimestresLocked.has(bim)) return;
        setCurrentLinkBimestre(bim);
        setCurrentLinkSlot(slot);
        setShowLinkDialog(true);
        setLoadingAvaliacoes(true);
        try {
            const q = query(
                collection(db, 'avaliacoes'),
                where('escola_id', '==', escolaAtivaId),
                where('turma_id', '==', turmaId),
                where('componente', '==', componente)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                titulo: d.data().titulo,
                data: d.data().data,
                valor: d.data().valor,
            } as AvaliacaoVinculo));
            setAvaliacoesList(list);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar avaliações.");
        } finally {
            setLoadingAvaliacoes(false);
        }
    };

    const handleLinkAvaliacao = async (avaliacao: AvaliacaoVinculo | null) => {
        if (!currentLinkBimestre || !currentLinkSlot) return;

        const newLinks = { ...avaliacoesLinks };
        newLinks[currentLinkBimestre] = {
            ...newLinks[currentLinkBimestre],
            [currentLinkSlot]: avaliacao
        };

        setAvaliacoesLinks(newLinks);
        await saveConfig(bimestresLocked, newLinks);
        setShowLinkDialog(false);
        toast.success(avaliacao ? "Avaliação vinculada!" : "Vínculo removido.");
    };

    // ── Filtered list ─────────────────────────────────────────────────────────

    const estudantesFiltrados = estudantes.filter(e =>
        e.nome.toLowerCase().includes(search.toLowerCase()) ||
        e.matricula?.toLowerCase().includes(search.toLowerCase())
    );

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <AppLayout title="Notas Parciais">
                <div className="flex items-center justify-center h-64">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            </AppLayout>
        );
    }

    return (
        <>
            <AppLayout title="Notas Parciais">
            <div className="space-y-6 animate-fade-in">

                {/* Header */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Notas Parciais</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              {turma?.nome} {turma?.serie ? `· ${turma.serie}` : ''} · Ano {ano}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/diario-digital')} className="shrink-0 gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Voltar para o Diário Digital</span>
            <span className="xs:hidden">Voltar</span>
          </Button>
        </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar estudante..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={componente}
                        onValueChange={v => setComponente(v)}
                        disabled={isComponenteFixo}
                    >
                        <SelectTrigger className="w-full sm:w-72">
                            <SelectValue placeholder="Selecionar componente curricular" />
                        </SelectTrigger>
                        <SelectContent>
                            {componentesDaTurma.map(c => (
                                <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {!componente ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                        <ClipboardList className="h-12 w-12 opacity-30" />
                        <p className="text-lg font-medium">Selecione um componente curricular</p>
                        <p className="text-sm">As notas parciais serão exibidas por bimestre.</p>
                    </div>
                ) : estudantesFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                        <ClipboardList className="h-12 w-12 opacity-30" />
                        <p>Nenhum estudante encontrado nesta turma.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {!podeEditar && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 flex items-start gap-3">
                                <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
                                <div className="text-sm">
                                    <p className="font-semibold">Modo de visualização</p>
                                    <p>Seu perfil ({role}) tem permissão apenas para visualizar as notas parciais. Apenas professores e admins podem editá-las.</p>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {BIMESTRES.map(bim => (
                            <Card
                                key={bim}
                                className={`border-2 ${BIMESTRE_COLORS[bim]} shadow-sm`}
                            >
                                <CardHeader className={`rounded-t-lg px-5 py-3 ${BIMESTRE_HEADER[bim]}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-base font-bold">
                                                {BIMESTRE_LABELS[bim]}
                                            </CardTitle>
                                            {bimestresLocked.has(bim) && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 text-red-700 border border-red-200">
                                                    🔒 Bloqueado
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {bimestresLocked.has(bim) ? (
                                                podeDesbloquear ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1 bg-white/70 hover:bg-white text-red-700 border-red-300"
                                                        onClick={() => handleUnlock(bim)}
                                                        disabled={unlocking === bim}
                                                    >
                                                        🔓 {unlocking === bim ? 'Desbloqueando...' : 'Habilitar Edição'}
                                                    </Button>
                                                ) : podeEditar ? (
                                                    <span className="text-xs text-red-600 italic self-center">Bloqueado. Solicite a reabertura.</span>
                                                ) : null
                                            ) : podeEditar ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1 bg-white/70 hover:bg-white"
                                                        onClick={() => handleSaveBimestre(bim)}
                                                        disabled={saving === bim || syncing !== null}
                                                    >
                                                        <Save className="h-3 w-3" />
                                                        {saving === bim ? 'Salvando...' : 'Salvar'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-xs gap-1"
                                                        onClick={() => handleSyncToNotas(bim)}
                                                        disabled={syncing === bim || saving !== null}
                                                        title="Enviar médias bimestrais para a página de Notas"
                                                    >
                                                        <Send className="h-3 w-3" />
                                                        {syncing === bim ? 'Enviando...' : 'Enviar para Notas'}
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                    <p className="text-xs opacity-70 mt-0.5">
                                        Componente: <span className="font-medium">{componente}</span>
                                    </p>
                                </CardHeader>

                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-white/60">
                                                    <TableHead className="text-xs font-semibold h-9 pl-4">Estudante</TableHead>
                                                    {(['av1', 'av2', 'av3', 'av4'] as const).map(slot => {
                                                        const vinculado = avaliacoesLinks[bim]?.[slot];
                                                        return (
                                                            <TableHead key={slot} className="text-center text-xs font-semibold h-9 w-16 p-0 border-x">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={() => openLinkDialog(bim, slot)}
                                                                                className={cn(
                                                                                    "w-full h-full flex flex-col items-center justify-center hover:bg-black/5 transition-colors uppercase leading-none",
                                                                                    vinculado && "text-primary font-bold bg-primary/5"
                                                                                )}
                                                                                disabled={bimestresLocked.has(bim) || !podeEditar}
                                                                            >
                                                                                <span className="text-[10px] opacity-70 mb-0.5">{slot}</span>
                                                                                {vinculado ? (
                                                                                    <LinkIcon className="h-3 w-3" />
                                                                                ) : (
                                                                                    <div className="h-3 w-3 rounded-full border border-dashed border-muted-foreground/50" />
                                                                                )}
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top" className="max-w-xs">
                                                                            {vinculado ? (
                                                                                <div className="space-y-1">
                                                                                    <p className="font-bold text-sm">{vinculado.titulo}</p>
                                                                                    <p className="text-xs opacity-80">{format(parseISO(vinculado.data), "dd/MM/yyyy")}</p>
                                                                                    {vinculado.valor && <p className="text-xs font-medium">Valor: {vinculado.valor}</p>}
                                                                                    <div className="pt-1 mt-1 border-t border-white/20">
                                                                                        <p className="text-[10px] font-medium text-primary-foreground italic">Clique para alterar ou remover</p>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-1">
                                                                                    <p className="text-sm font-medium">Vincular avaliação</p>
                                                                                    <p className="text-xs opacity-70">Clique para selecionar uma avaliação para esta coluna</p>
                                                                                </div>
                                                                            )}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </TableHead>
                                                        );
                                                    })}
                                                    <TableHead className="text-center text-xs font-semibold h-9 w-20">Média</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {estudantesFiltrados.map((est, idx) => {
                                                    const np = notas[bim]?.[est.id] ?? emptyNota();
                                                    const media = calcMedia(np);
                                                    return (
                                                        <TableRow
                                                            key={est.id}
                                                            className={`border-b hover:bg-white/40 ${idx % 2 === 0 ? 'bg-white/20' : ''}`}
                                                        >
                                                            <TableCell className="pl-4 py-2">
                                                                <div className="flex items-baseline gap-1.5 leading-tight">
                                                                    <span className="text-[10px] text-muted-foreground shrink-0">{est.matricula}</span>
                                                                    <span className="text-[10px] text-muted-foreground shrink-0">-</span>
                                                                    <span className="text-sm font-medium">{est.nome}</span>
                                                                </div>
                                                            </TableCell>
                                                            {(['av1', 'av2', 'av3', 'av4'] as const).map(av => (
                                                                <TableCell key={av} className="text-center py-1.5 px-1">
                                                                    <Input
                                                                        value={np[av] != null ? fmtN(np[av]) : ''}
                                                                        onChange={e => handleAvChange(bim, est.id, av, e.target.value)}
                                                                        onBlur={() => handleAvBlur(bim, est.id, av)}
                                                                        inputMode="decimal"
                                                                        className="h-7 text-center text-sm px-1 bg-white/80 focus:bg-white border-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        placeholder="—"
                                                                        disabled={bimestresLocked.has(bim) || !podeEditar}
                                                                    />
                                                                </TableCell>
                                                            ))}
                                                            <TableCell className={`text-center py-2 text-sm font-bold ${getNotaColor(media)}`}>
                                                                {media != null ? fmtN(media) : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Bimester summary */}
                                    <div className="px-4 py-2 border-t bg-white/30 flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            {estudantesFiltrados.filter(e => calcMedia(notas[bim]?.[e.id] ?? emptyNota()) != null).length} de {estudantesFiltrados.length} com notas
                                        </span>
                                        <Badge variant="secondary" className="text-xs">
                                            Média da turma:{' '}
                                            {(() => {
                                                const medias = estudantesFiltrados
                                                    .map(e => calcMedia(notas[bim]?.[e.id] ?? emptyNota()))
                                                    .filter(m => m != null) as number[];
                                                if (medias.length === 0) return '—';
                                                return fmtN(medias.reduce((a, b) => a + b, 0) / medias.length);
                                            })()}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>

            {/* Diálogo de Vínculo de Avaliação */}
            <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-primary" />
                            Vincular Avaliação ao {currentLinkSlot?.toUpperCase()}
                        </DialogTitle>
                        <DialogDescription>
                            Selecione uma avaliação registrada para preencher automaticamente esta coluna.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Avaliações Disponíveis</h4>
                            <Badge variant="outline" className="text-[10px]">
                                {componente}
                            </Badge>
                        </div>

                        <ScrollArea className="h-[300px] pr-4">
                            {loadingAvaliacoes ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            ) : avaliacoesList.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <ClipboardList className="h-10 w-10 mx-auto opacity-20 mb-2" />
                                    <p className="text-sm">Nenhuma avaliação encontrada para este componente.</p>
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        className="mt-2"
                                        onClick={() => navigate(`/diario-digital/avaliacoes/${turmaId}?componente=${encodeURIComponent(componente)}`)}
                                    >
                                        Ir para Calendário de Avaliações
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {avaliacoesList.map((av) => {
                                        // Verifica se já está vinculada a outro slot no mesmo bimestre
                                        const isLinkedHere = avaliacoesLinks[currentLinkBimestre!]?.[currentLinkSlot!]?.id === av.id;
                                        const isLinkedElseWhere = Object.entries(avaliacoesLinks[currentLinkBimestre!] || {})
                                            .some(([s, v]) => s !== currentLinkSlot && v?.id === av.id);

                                        return (
                                            <div
                                                key={av.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:border-primary group",
                                                    isLinkedHere ? "border-primary bg-primary/5" : "border-border",
                                                    isLinkedElseWhere && "opacity-50 cursor-not-allowed grayscale"
                                                )}
                                                onClick={() => !isLinkedElseWhere && handleLinkAvaliacao(isLinkedHere ? null : av)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm truncate">{av.titulo}</p>
                                                        {isLinkedHere && <Badge className="h-4 px-1 text-[8px] bg-primary">VINCULADO</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(parseISO(av.data), "dd/MM/yyyy")}
                                                        </div>
                                                        {av.valor && (
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                <Info className="h-3 w-3" />
                                                                Valor: {av.valor}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {isLinkedHere ? (
                                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-red-50 group-hover:text-red-500">
                                                        <Check className="h-3 w-3 group-hover:hidden" />
                                                        <Unlink className="h-3 w-3 hidden group-hover:block" />
                                                    </div>
                                                ) : (
                                                    !isLinkedElseWhere && (
                                                        <div className="h-6 w-6 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary">
                                                            <LinkIcon className="h-3 w-3" />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <DialogFooter className="sm:justify-between border-t pt-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLinkDialog(false)}
                        >
                            Fechar
                        </Button>
                        {avaliacoesLinks[currentLinkBimestre!]?.[currentLinkSlot!] && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleLinkAvaliacao(null)}
                                className="gap-2"
                            >
                                <Unlink className="h-3 w-3" />
                                Remover Vínculo
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
