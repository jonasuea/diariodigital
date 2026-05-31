import { localDb } from '@/lib/db';
import { BaseResilientService } from '@/services/BaseResilientService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { isOfflineModeEnabled } from '@/lib/utils';
import { FirebaseFacade } from '@/facades/FirebaseFacade';

/**
 * Repositório de Mini Avaliações (Quinzenais / MEC)
 */
export class MiniAvaliacaoRepository extends BaseResilientService<any> {
  protected collectionName = 'mini_avaliacoes';
  protected localTable = localDb.mini_avaliacoes;

  /**
   * Baixa mini-avaliações de uma turma do Firestore para o IndexedDB
   */
  async seedByTurma(turmaId: string, escolaId: string) {
    if (!navigator.onLine) return;
    try {
      const q = query(
        collection(db, 'mini_avaliacoes'),
        where('turma_id', '==', turmaId),
        where('escola_id', '==', escolaId)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (records.length > 0) {
        await localDb.mini_avaliacoes.bulkPut(records);
      }
    } catch (error) {
      console.warn('[MiniAvaliacaoRepo] Erro ao sincronizar mini_avaliacoes:', error);
    }
  }

  /**
   * Baixa respostas de uma mini-avaliação do Firestore para o IndexedDB
   */
  async seedRespostas(miniAvaliacaoId: string) {
    if (!navigator.onLine) return;
    try {
      const q = query(
        collection(db, 'respostas_mini_avaliacoes'),
        where('mini_avaliacao_id', '==', miniAvaliacaoId)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (records.length > 0) {
        await localDb.respostas_mini_avaliacoes.bulkPut(records);
      }
    } catch (error) {
      console.warn('[MiniAvaliacaoRepo] Erro ao sincronizar respostas:', error);
    }
  }

  /**
   * Salva uma mini-avaliação localmente e enfileira para sincronização
   */
  async saveMiniAvaliacao(data: any): Promise<string> {
    const id = data.id || crypto.randomUUID();
    const payload = { ...data, id, excluido: false };
    
    if (!isOfflineModeEnabled() && navigator.onLine) {
      await FirebaseFacade.setDocument('mini_avaliacoes', id, payload);
      await localDb.mini_avaliacoes.put(payload);
    } else {
      await localDb.mini_avaliacoes.put(payload);
      await localDb.sync_queue.add({
        collection: 'mini_avaliacoes',
        action: 'create',
        data: payload,
        timestamp: Date.now()
      });
    }
    
    return id;
  }

  /**
   * Salva as respostas de um estudante para uma mini-avaliação (híbrido)
   */
  async saveResposta(data: any): Promise<void> {
    const id = data.id || `${data.mini_avaliacao_id}_${data.estudante_id}`;
    const payload = { ...data, id, excluido: false };
    
    if (!isOfflineModeEnabled() && navigator.onLine) {
      await FirebaseFacade.setDocument('respostas_mini_avaliacoes', id, payload);
      await localDb.respostas_mini_avaliacoes.put(payload);
    } else {
      await localDb.respostas_mini_avaliacoes.put(payload);
      await localDb.sync_queue.add({
        collection: 'respostas_mini_avaliacoes',
        action: 'create',
        data: payload,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Busca todas as mini-avaliações de uma turma por componente (híbrido)
   */
  async getByTurmaAndComponente(turmaId: string, componente: string) {
    if (!isOfflineModeEnabled() && navigator.onLine) {
      const q = query(
        collection(db, 'mini_avaliacoes'),
        where('turma_id', '==', turmaId),
        where('componente', '==', componente)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.excluido !== true);
      // Opcional: Atualizar cache local para agilizar navegação futura
      if (docs.length > 0) await localDb.mini_avaliacoes.bulkPut(docs);
      return docs;
    }

    return await localDb.mini_avaliacoes
      .where('[turma_id+componente]')
      .equals([turmaId, componente])
      .filter(r => r.excluido !== true)
      .toArray();
  }

  /**
   * Busca todas as respostas de uma mini-avaliação (híbrido)
   */
  async getRespostasByMiniAvaliacao(miniAvaliacaoId: string) {
    if (!isOfflineModeEnabled() && navigator.onLine) {
      const q = query(
        collection(db, 'respostas_mini_avaliacoes'),
        where('mini_avaliacao_id', '==', miniAvaliacaoId)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.excluido !== true);
      if (docs.length > 0) await localDb.respostas_mini_avaliacoes.bulkPut(docs);
      return docs;
    }

    return await localDb.respostas_mini_avaliacoes
      .where('mini_avaliacao_id')
      .equals(miniAvaliacaoId)
      .filter(r => r.excluido !== true)
      .toArray();
  }

  /**
   * Busca a resposta de um estudante específico para uma mini-avaliação
   */
  async getRespostaDoEstudante(miniAvaliacaoId: string, estudanteId: string) {
    if (!isOfflineModeEnabled() && navigator.onLine) {
      const q = query(
        collection(db, 'respostas_mini_avaliacoes'),
        where('mini_avaliacao_id', '==', miniAvaliacaoId),
        where('estudante_id', '==', estudanteId)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.excluido !== true);
      if (docs.length > 0) return docs[0];
      return null;
    }

    return await localDb.respostas_mini_avaliacoes
      .where('[mini_avaliacao_id+estudante_id]')
      .equals([miniAvaliacaoId, estudanteId])
      .first();
  }

  /**
   * Busca habilidades trabalhadas nas aulas dos últimos N dias de uma turma e componente
   */
  async getHabilidadesTrabalhadas(turmaId: string, componente: string, diasAtras: number): Promise<string[]> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasAtras);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0]; // YYYY-MM-DD

    let registros: any[] = [];

    if (!isOfflineModeEnabled() && navigator.onLine) {
      const q = query(
        collection(db, 'registros_aulas'),
        where('turma_id', '==', turmaId),
        where('disciplina', '==', componente)
      );
      const snap = await getDocs(q);
      registros = snap.docs.map(d => d.data()).filter((r: any) => r.data >= dataLimiteStr && r.status === 'Ministrado');
    } else {
      registros = await localDb.registros_aulas
        .where('[turma_id+componente]')
        .equals([turmaId, componente])
        .filter(r => r.data >= dataLimiteStr && r.status === 'Ministrado')
        .toArray();
    }

    const habilidadesSet = new Set<string>();
    registros.forEach(r => {
      if (Array.isArray(r.habilidades)) {
        r.habilidades.forEach((h: string) => habilidadesSet.add(h));
      }
    });

    return Array.from(habilidadesSet);
  }
}

export const miniAvaliacaoRepo = new MiniAvaliacaoRepository();
