import { useState, useCallback, useEffect } from 'react';
import { turmaRepo, estudanteRepo, diasLetivosRepo, eventosRepo } from '@/repositories/CadastrosRepository';
import { planejamentoRepo } from '@/repositories/PlanejamentoRepository';
import { avaliacaoRepo } from '@/repositories/AvaliacaoRepository';
import { toast } from 'sonner';

interface SyncStatus {
  isSyncing: boolean;
  progress: number;
  lastSync: string | null;
}

export function useSyncData(escolaId: string | null, professorId: string | null, turmas: any[]) {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    progress: 0,
    lastSync: localStorage.getItem(`last_sync_${escolaId}_${professorId}`)
  });

  const startSync = useCallback(async (manual = false) => {
    if (!navigator.onLine || !escolaId || !professorId || turmas.length === 0) {
      if (manual && !navigator.onLine) toast.error("Conecte-se à internet para sincronizar.");
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true, progress: 0 }));
    
    try {
      console.log(`[Sync] Iniciando sincronização para escola ${escolaId}`);
      
      // 1. Sincronizar dados globais da escola
      await Promise.all([
        diasLetivosRepo.seed(escolaId),
        eventosRepo.seed(escolaId),
        turmaRepo.seed(escolaId)
      ]);

      let completed = 0;
      const totalSteps = turmas.length;

      // 2. Sincronizar dados específicos de cada turma do professor
      for (const turma of turmas) {
        console.log(`[Sync] Sincronizando turma: ${turma.nome}`);
        
        // Sincronizar estudantes
        await estudanteRepo.seed(turma.id, escolaId);
        
        // Identificar série para BNCC
        const serieVal = turma.serie || turma.classificacao || turma.ano || turma.nome || "";
        const serie = String(serieVal).trim();
        
        // Sincronizar registros de aula e base curricular para cada componente do professor nesta turma
        if (turma.componentes && Array.isArray(turma.componentes)) {
          const componentesProfessor = turma.componentes.filter((c: any) => c.professorId === professorId);
          
          if (componentesProfessor.length > 0) {
            for (const comp of componentesProfessor) {
              await Promise.all([
                planejamentoRepo.seedBaseCurricular(serie, comp.nome),
                planejamentoRepo.seedRegistros(turma.id, comp.nome),
                avaliacaoRepo.seedAvaliacoes(turma.id, escolaId)
              ]);
            }
          } else {
            // Caso educação infantil (sem componentes explícitos por professor)
            await Promise.all([
              planejamentoRepo.seedBaseCurricular(serie),
              planejamentoRepo.seedRegistros(turma.id),
              avaliacaoRepo.seedAvaliacoes(turma.id, escolaId)
            ]);
          }
        }

        completed++;
        setStatus(prev => ({ ...prev, progress: Math.round((completed / totalSteps) * 100) }));
      }

      const now = new Date().toISOString();
      localStorage.setItem(`last_sync_${escolaId}_${professorId}`, now);
      setStatus({ isSyncing: false, progress: 100, lastSync: now });
      
      if (manual) toast.success("Sincronização concluída com sucesso!");
      console.log(`[Sync] Sincronização finalizada em ${now}`);
    } catch (error) {
      console.error("[Sync] Erro durante sincronização:", error);
      setStatus(prev => ({ ...prev, isSyncing: false }));
      if (manual) toast.error("Falha na sincronização periódica.");
    }
  }, [escolaId, professorId, turmas]);

  // Sync automático apenas se a última sync for de mais de 1 hora atrás
  useEffect(() => {
    if (!status.lastSync && turmas.length > 0) {
      startSync();
    } else if (status.lastSync && turmas.length > 0) {
      const lastSyncDate = new Date(status.lastSync);
      const oneHourAgo = new Date(Date.now() - 3600000);
      if (lastSyncDate < oneHourAgo) {
        startSync();
      }
    }
  }, [turmas.length, escolaId, professorId]);

  return { ...status, startSync };
}
