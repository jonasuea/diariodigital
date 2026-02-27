import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Send, Search, ClipboardList } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, doc, updateDoc,
    addDoc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

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
    av1: number | null;
    av2: number | null;
    av3: number | null;
    av4: number | null;
    media: number | null;
}

// Record: estudanteId → NotaParcial
type NotasPorEstudante = Record<string, NotaParcial>;

// All bimesters: 1-4 → NotasPorEstudante
type NotasState = Record<number, NotasPorEstudante>;

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

function calcMedia(n: NotaParcial): number | null {
    const vals = [n.av1, n.av2, n.av3, n.av4].filter(v => v != null) as number[];
    if (vals.length === 0) return null;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(m * 10) / 10;
}

function fmtN(v: number | null | undefined): string {
    return v != null ? v.toFixed(1) : '';
}

function getNotaColor(v: number | null): string {
    if (v == null) return '';
    if (v >= 7) return 'text-green-700 font-semibold';
    if (v >= 5) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
}

function maskNota(raw: string): string {
    let v = raw.replace(/[^0-9.]/g, '');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if (parts.length === 2) v = parts[0] + '.' + parts[1].slice(0, 1);
    const num = parseFloat(v);
    if (!isNaN(num) && num > 10) v = '10';
    return v;
}

function parseNota(s: string): number | null {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : Math.min(10, Math.max(0, n));
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

    const { role } = useUserRole();
    const ROLES_GESTAO = ['admin', 'gestor', 'pedagogo', 'secretario'];
    const podeDesbloquear = role ? ROLES_GESTAO.includes(role) : false;
    const isProfessor = role === 'professor';

    // notas[bimestre][estudanteId] = NotaParcial
    const [notas, setNotas] = useState<NotasState>({ 1: {}, 2: {}, 3: {}, 4: {} });

    const isComponenteFixo = !!searchParams.get('componente');
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
                const locked: number[] = snap.data()?.bimestres_bloqueados || [];
                setBimestresLocked(new Set(locked));
            } else {
                setBimestresLocked(new Set());
            }
        } catch (err) {
            console.warn('Erro ao carregar config de bloqueio:', err);
        }
    }

    async function saveConfig(locked: Set<number>) {
        if (!configId) return;
        try {
            await setDoc(doc(db, 'notas_parciais_config', configId), {
                turma_id: turmaId,
                componente,
                ano,
                bimestres_bloqueados: Array.from(locked),
            }, { merge: true });
        } catch (err) {
            console.warn('Erro ao salvar config de bloqueio:', err);
        }
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        if (!turmaId) return;
        setLoading(true);
        try {
            const turmaSnap = await getDoc(doc(db, 'turmas', turmaId));
            if (!turmaSnap.exists()) { toast.error('Turma não encontrada'); navigate(-1); return; }
            const turmaData = { id: turmaSnap.id, ...turmaSnap.data() } as Turma;
            setTurma(turmaData);

            const estudantesSnap = await getDocs(
                query(collection(db, 'estudantes'), where('turma_id', '==', turmaId))
            );
            const lista = estudantesSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as Estudante))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            setEstudantes(lista);
        } catch (err) {
            toast.error('Erro ao carregar dados');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [turmaId, navigate]);

    const loadNotasParciais = useCallback(async () => {
        if (!turmaId || !componente || estudantes.length === 0) return;

        try {
            const snap = await getDocs(
                query(
                    collection(db, 'notas_parciais'),
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
            console.error('Erro ao carregar notas parciais:', err);
        }
    }, [turmaId, componente, ano, estudantes]);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { loadNotasParciais(); }, [loadNotasParciais]);
    // Recarrega config de bloqueio sempre que componente ou turma mudam
    useEffect(() => { loadConfig(); }, [configId]);


    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleAvChange(bim: number, estudanteId: string, field: keyof Pick<NotaParcial, 'av1' | 'av2' | 'av3' | 'av4'>, raw: string) {
        const masked = maskNota(raw);
        setNotas(prev => {
            const nota = { ...prev[bim][estudanteId] };
            (nota as any)[field] = masked === '' ? null : parseNota(masked);
            nota.media = calcMedia(nota);
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
                        componente,
                        ano,
                        bimestre: bim,
                        estudante_id: estudanteId,
                        av1: nota.av1,
                        av2: nota.av2,
                        av3: nota.av3,
                        av4: nota.av4,
                        media,
                        updated_at: serverTimestamp(),
                    };
                    if (nota.id) {
                        await updateDoc(doc(db, 'notas_parciais', nota.id), payload);
                    } else {
                        const hasData = nota.av1 != null || nota.av2 != null || nota.av3 != null || nota.av4 != null;
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
            toast.error('Erro ao salvar notas parciais.');
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
            toast.info(`${bim}º bimestre bloqueado para edição. Apenas gestores podem reabrir.`);

        } catch (err) {
            toast.error('Erro ao enviar médias para Notas.');
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
            toast.error('Erro ao desbloquear bimestre.');
            console.error(err);
        } finally {
            setUnlocking(null);
        }
    }

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
        <AppLayout title="Notas Parciais">
            <div className="space-y-6 animate-fade-in">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/diario-digital')} className="gap-2">
                        <ArrowLeft className="h-5 w-5" />
                        Voltar para o Diário Digital
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Notas Parciais</h1>
                        <p className="text-muted-foreground text-sm">
                            {turma?.nome} {turma?.serie ? `· ${turma.serie}` : ''} · Ano {ano}
                        </p>
                    </div>
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
                                                ) : (
                                                    <span className="text-xs text-red-600 italic self-center">Somente gestores podem editar</span>
                                                )
                                            ) : (
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
                                            )}
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
                                                    <TableHead className="text-center text-xs font-semibold h-9 w-16">AV1</TableHead>
                                                    <TableHead className="text-center text-xs font-semibold h-9 w-16">AV2</TableHead>
                                                    <TableHead className="text-center text-xs font-semibold h-9 w-16">AV3</TableHead>
                                                    <TableHead className="text-center text-xs font-semibold h-9 w-16">AV4</TableHead>
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
                                                                <div className="text-sm font-medium leading-tight">{est.nome}</div>
                                                                <div className="text-xs text-muted-foreground">{est.matricula}</div>
                                                            </TableCell>
                                                            {(['av1', 'av2', 'av3', 'av4'] as const).map(av => (
                                                                <TableCell key={av} className="text-center py-1.5 px-1">
                                                                    <Input
                                                                        value={np[av] != null ? fmtN(np[av]) : ''}
                                                                        onChange={e => handleAvChange(bim, est.id, av, e.target.value)}
                                                                        inputMode="decimal"
                                                                        className="h-7 text-center text-sm px-1 bg-white/80 focus:bg-white border-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        placeholder="—"
                                                                        disabled={bimestresLocked.has(bim) && (isProfessor || !podeDesbloquear)}
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
                )}
            </div>
        </AppLayout>
    );
}
