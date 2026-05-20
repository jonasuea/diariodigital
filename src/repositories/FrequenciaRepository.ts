import { localDb } from '@/lib/db';
import { BaseResilientService } from '@/services/BaseResilientService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export interface Frequencia {
  id: string;
  escola_id: string;
  turma_id: string;
  data: string;
  excluido?: boolean;
  excluido_em?: string;
  excluido_por?: string;
  presencas?: Record<string, boolean>;
}

export interface EntradaDiario {
  id: string;
  escola_id: string;
  turma_id: string;
  data: string;
  excluido?: boolean;
  excluido_em?: string;
  excluido_por?: string;
}

/**
 * Repositório de Frequências
 */
export class FrequenciaRepository extends BaseResilientService<Frequencia> {
  protected collectionName = 'frequencias';
  protected localTable = localDb.frequencias;

  async seed(turmaId: string, escolaId: string, startDate: string, endDate: string) {
    if (!navigator.onLine) return;
    
    // Sincroniza frequências
    const qFreq = query(
      collection(db, 'frequencias'),
      where('escola_id', '==', escolaId),
      where('turma_id', '==', turmaId),
      where('data', '>=', startDate),
      where('data', '<=', endDate)
    );
    const snapFreq = await getDocs(qFreq);
    const recordsFreq = snapFreq.docs.map(d => ({ id: d.id, ...d.data() }) as unknown as Frequencia);
    await this.localTable.bulkPut(recordsFreq);

    // Sincroniza entradas no diário (marcadores de data editada)
    const qEntradas = query(
      collection(db, 'entradas_diario'),
      where('escola_id', '==', escolaId),
      where('turma_id', '==', turmaId),
      where('data', '>=', startDate),
      where('data', '<=', endDate)
    );
    const snapEntradas = await getDocs(qEntradas);
    const recordsEntradas = snapEntradas.docs.map(d => ({ id: d.id, ...d.data() }) as unknown as EntradaDiario);
    await localDb.entradas_diario.bulkPut(recordsEntradas);
    
    // Sincroniza dias letivos (consulta)
    const qDias = query(
      collection(db, 'dias_letivos'),
      where('escola_id', '==', escolaId),
      where('data', '>=', startDate),
      where('data', '<=', endDate)
    );
    const snapDias = await getDocs(qDias);
    const recordsDias = snapDias.docs.map(d => ({ id: d.id, ...d.data() }));
    await localDb.dias_letivos.bulkPut(recordsDias);
  }

  async getByTurmaAndRange(turmaId: string, startDate: string, endDate: string) {
    const freq = await this.localTable
      .where('turma_id')
      .equals(turmaId)
      .filter(f => f.data >= startDate && f.data <= endDate && !f.excluido)
      .toArray();

    const entradas = await localDb.entradas_diario
      .where('turma_id')
      .equals(turmaId)
      .filter(e => e.data >= startDate && e.data <= endDate)
      .toArray();

    return { freq, entradas };
  }

  async recordEntrada(data: EntradaDiario) {
    await localDb.entradas_diario.put(data);
    await localDb.sync_queue.add({
      collection: 'entradas_diario',
      action: 'update',
      data: data,
      timestamp: Date.now()
    });
  }

  async loadTurma(turmaId: string) {
    return await localDb.turmas.get(turmaId);
  }
}

export const frequenciaRepo = new FrequenciaRepository();
