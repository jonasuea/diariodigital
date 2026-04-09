import { localDb } from '@/lib/db';
import { BaseResilientService } from '@/services/BaseResilientService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';

/**
 * Repositório de Turmas
 */
export class TurmaRepository extends BaseResilientService<any> {
  protected collectionName = 'turmas';
  protected localTable = localDb.turmas;

  async seed(escolaId: string) {
    if (!navigator.onLine) return;
    const q = query(collection(db, 'turmas'), where('escola_id', '==', escolaId));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await this.localTable.bulkPut(records);
  }

  async getById(id: string) {
    return await this.localTable.get(id);
  }
}

/**
 * Repositório de Estudantes
 */
export class EstudanteRepository extends BaseResilientService<any> {
  protected collectionName = 'estudantes';
  protected localTable = localDb.estudantes;

  async seed(turmaId: string, escolaId: string) {
    if (!navigator.onLine) return;
    const q = query(
      collection(db, 'estudantes'), 
      where('escola_id', '==', escolaId),
      where('turma_id', '==', turmaId),
      orderBy('nome')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await this.localTable.bulkPut(records);
  }

  async getByTurma(turmaId: string) {
    return await this.localTable
      .where('turma_id')
      .equals(turmaId)
      .sortBy('nome');
  }
}

export const turmaRepo = new TurmaRepository();
export const estudanteRepo = new EstudanteRepository();

/**
 * Repositório de Eventos
 */
export class EventosRepository extends BaseResilientService<any> {
  protected collectionName = 'eventos';
  protected localTable = localDb.eventos;

  async seed(escolaId: string) {
    if (!navigator.onLine) return;
    const q = query(collection(db, 'eventos'), where('escola_id', '==', escolaId));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await this.localTable.bulkPut(records);
  }

  async getByEscola(escolaId: string) {
    return await this.localTable.where('escola_id').equals(escolaId).toArray();
  }
}

/**
 * Repositório de Dias Letivos
 */
export class DiasLetivosRepository extends BaseResilientService<any> {
  protected collectionName = 'dias_letivos';
  protected localTable = localDb.dias_letivos;

  async seed(escolaId: string) {
    if (!navigator.onLine) return;
    const q = query(collection(db, 'dias_letivos'), where('escola_id', '==', escolaId));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await this.localTable.bulkPut(records);
  }

  async getByEscola(escolaId: string) {
    return await this.localTable.where('escola_id').equals(escolaId).toArray();
  }
}

export const eventosRepo = new EventosRepository();
export const diasLetivosRepo = new DiasLetivosRepository();
