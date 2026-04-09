import { localDb } from '@/lib/db';
import { BaseResilientService } from '@/services/BaseResilientService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Repositório de Planejamento (Objetos de Conhecimento / Registros de Aula)
 */
export class PlanejamentoRepository extends BaseResilientService<any> {
  protected collectionName = 'registros_aulas';
  protected localTable = localDb.registros_aulas;

  /**
   * Baixa a base curricular para o IndexedDB para permitir consultas offline
   */
  async seedBaseCurricular(serie: string, componente?: string) {
    if (!navigator.onLine) return;

    let q = query(
      collection(db, "base_curricular"),
      where("serie", "array-contains", serie.toUpperCase())
    );

    if (componente) {
      q = query(q, where("componente", "==", componente));
    }

    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await localDb.base_curricular.bulkPut(records);
  }

  /**
   * Busca a base curricular do cache local
   */
  async getBaseCurricularLocal(serie: string, componente?: string) {
    let collection = localDb.base_curricular.where('serie').equals(serie.toUpperCase());
    
    if (componente) {
      return await collection.and(item => item.componente === componente).toArray();
    }
    
    return await collection.toArray();
  }

  /**
   * Seed de registros de aula existentes
   */
  async seedRegistros(turmaId: string, componente?: string) {
    if (!navigator.onLine) return;

    let q = query(
      collection(db, 'registros_aulas'),
      where('turma_id', '==', turmaId)
    );

    if (componente) {
      q = query(q, where('componente', '==', componente));
    }

    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await this.localTable.bulkPut(records);
  }

  async findRegistro(turmaId: string, data: string, componente?: string) {
    if (componente) {
      return await this.localTable
        .where('[turma_id+data+componente]')
        .equals([turmaId, data, componente])
        .first();
    } else {
      // Caso educação infantil (sem componente específico)
      return await this.localTable
        .where({ turma_id: turmaId, data: data })
        .first();
    }
  }

  async getRegistrosByTurma(turmaId: string, componente?: string) {
    if (componente) {
      return await this.localTable
        .where({ turma_id: turmaId, componente: componente })
        .toArray();
    }
    return await this.localTable
      .where('turma_id')
      .equals(turmaId)
      .toArray();
  }
}

export const planejamentoRepo = new PlanejamentoRepository();
