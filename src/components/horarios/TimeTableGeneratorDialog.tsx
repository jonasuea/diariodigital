import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Calendar, Save, Wand2 } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';

interface ComponenteCurricular {
    nome: string;
    professorId: string;
    professorNome?: string;
    diaPlanejamento?: string;
}

interface Turma {
    id: string;
    nome: string;
    componentes: ComponenteCurricular[];
}

interface TimeTableGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    turma: Turma | null;
    onSuccess?: () => void;
}

const DIAS_SEMANA = [
    { value: 'nenhum', label: 'Nenhum' },
    { value: 'segunda', label: 'Segunda-feira' },
    { value: 'terca', label: 'Terça-feira' },
    { value: 'quarta', label: 'Quarta-feira' },
    { value: 'quinta', label: 'Quinta-feira' },
    { value: 'sexta', label: 'Sexta-feira' },
];

const TEMPOS = [
    { inicio: '07:00', fim: '07:50', label: '1º Tempo' },
    { inicio: '07:50', fim: '08:40', label: '2º Tempo' },
    { inicio: '08:40', fim: '09:30', label: '3º Tempo' },
    { inicio: '09:50', fim: '10:40', label: '4º Tempo' },
    { inicio: '10:40', fim: '11:30', label: '5º Tempo' },
];

export function TimeTableGeneratorDialog({ open, onOpenChange, turma, onSuccess }: TimeTableGeneratorDialogProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [componentes, setComponentes] = useState<ComponenteCurricular[]>([]);

    useEffect(() => {
        if (open && turma) {
            fetchTurmaData();
        }
    }, [open, turma]);

    const fetchTurmaData = async () => {
        if (!turma) return;
        setLoading(true);
        try {
            const turmaDoc = await getDoc(doc(db, 'turmas', turma.id));
            if (turmaDoc.exists()) {
                const data = turmaDoc.data();
                const rawComps = (data.componentes || []).filter((c: ComponenteCurricular) => c.professorId);

                // Buscar nomes dos professores que podem estar faltando
                const compsComNomes = await Promise.all(
                    rawComps.map(async (comp: ComponenteCurricular) => {
                        if (comp.professorNome) return comp;

                        try {
                            const profDoc = await getDoc(doc(db, 'professores', comp.professorId));
                            if (profDoc.exists()) {
                                return { ...comp, professorNome: profDoc.data().nome };
                            }
                        } catch (err) {
                            console.error(`Erro ao buscar nome do professor ${comp.professorId}:`, err);
                        }
                        return comp;
                    })
                );

                setComponentes(compsComNomes);
            }
        } catch (error) {
            console.error("Erro ao carregar dados da turma:", error);
            toast.error("Erro ao carregar componentes da turma");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePlanejamento = (index: number, dia: string) => {
        const newComps = [...componentes];
        newComps[index] = { ...newComps[index], diaPlanejamento: dia === 'nenhum' ? undefined : dia };
        setComponentes(newComps);
    };

    const handleSave = async () => {
        if (!turma) return;
        setSaving(true);
        try {
            const turmaRef = doc(db, 'turmas', turma.id);
            const turmaDoc = await getDoc(turmaRef);

            if (turmaDoc.exists()) {
                const currentData = turmaDoc.data();
                const allComponentes = currentData.componentes || [];

                const updatedAllComponentes = allComponentes.map((c: ComponenteCurricular) => {
                    const match = componentes.find(updated => updated.nome === c.nome && updated.professorId === c.professorId);
                    if (match) {
                        return { ...c, diaPlanejamento: match.diaPlanejamento };
                    }
                    return c;
                });

                await updateDoc(turmaRef, {
                    componentes: updatedAllComponentes
                });

                toast.success("Restrições de planejamento salvas com sucesso!");
                if (onSuccess) onSuccess();
            }
        } catch (error) {
            console.error("Erro ao salvar restrições:", error);
            toast.error("Erro ao salvar restrições de planejamento");
        } finally {
            setSaving(false);
        }
    };

    const handleDistribute = async () => {
        if (!turma) return;
        setSaving(true);
        try {
            // 1. Definir carga horária por componente (simplificado para 25 tempos semanais)
            // Se tiver 5 principais, damos 4 ou 5 tempos. Se tiver menos, aumentamos.
            const totalTemposSemanais = 25; // 5 tempos * 5 dias
            const perComp = Math.floor(totalTemposSemanais / componentes.length);
            const extra = totalTemposSemanais % componentes.length;

            let distribution: any[] = [];
            let componentsToAssign: string[] = [];

            componentes.forEach((comp, idx) => {
                const count = perComp + (idx < extra ? 1 : 0);
                for (let i = 0; i < count; i++) componentsToAssign.push(comp.nome);
            });

            // Embaralhar para evitar padrões muito rígidos (opcional)
            componentsToAssign.sort(() => Math.random() - 0.5);

            const diasUteis = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
            const novaGrade: any[] = [];

            // 2. Preencher a grade respeitando o dia de planejamento
            for (const dia of diasUteis) {
                for (const tempo of TEMPOS) {
                    // Encontrar um componente que possa ser alocado neste dia/tempo
                    let foundIdx = -1;
                    for (let i = 0; i < componentsToAssign.length; i++) {
                        const compNome = componentsToAssign[i];
                        const compConfig = componentes.find(c => c.nome === compNome);

                        if (compConfig?.diaPlanejamento !== dia) {
                            foundIdx = i;
                            break;
                        }
                    }

                    if (foundIdx !== -1) {
                        const compNome = componentsToAssign.splice(foundIdx, 1)[0];
                        novaGrade.push({
                            turma_ids: [turma.id],
                            dia,
                            inicio: tempo.inicio,
                            fim: tempo.fim,
                            componente: compNome
                        });
                    }
                }
            }

            // 3. Limpar horários antigos da turma e salvar novos
            const horariosRef = collection(db, 'horarios');
            const q = query(horariosRef, where('turma_ids', 'array-contains', turma.id));
            const oldDocs = await getDocs(q);

            const batch = writeBatch(db);
            oldDocs.forEach(d => batch.delete(d.ref));
            novaGrade.forEach(h => batch.set(doc(horariosRef), h));

            await batch.commit();

            toast.success("Professores distribuídos e horários gerados com sucesso!");
            if (onSuccess) onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Erro ao distribuir professores:", error);
            toast.error("Erro ao gerar distribuição de professores");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Configurar Gerador - {turma?.nome}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Defina os dias de planejamento para cada professor. Nestes dias, o gerador não alocará aulas deste componente.
                    </p>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : componentes.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">Nenhum componente com professor alocado nesta turma.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">Componente / Professor</th>
                                        <th className="text-left p-3 font-semibold w-48">Dia de Planejamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-black">
                                    {componentes.map((comp, index) => (
                                        <tr key={`${comp.nome}-${comp.professorId}`} className="hover:bg-muted/30">
                                            <td className="p-3">
                                                <div className="font-medium">{comp.nome}</div>
                                                <div className="text-xs text-muted-foreground">{comp.professorNome || 'Professor não identificado'}</div>
                                            </td>
                                            <td className="p-3">
                                                <Select
                                                    value={comp.diaPlanejamento || 'nenhum'}
                                                    onValueChange={(val) => handleUpdatePlanejamento(index, val)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DIAS_SEMANA.map(dia => (
                                                            <SelectItem key={dia.value} value={dia.value}>
                                                                {dia.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleSave} disabled={saving || componentes.length === 0}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Planejamento
                        </Button>
                        <Button onClick={handleDistribute} disabled={saving || componentes.length === 0} className="bg-primary hover:bg-primary/90">
                            {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="mr-2 h-4 w-4" />
                            )}
                            Distribuir Professores
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
