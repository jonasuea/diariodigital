import { localDb } from '@/lib/db';
import { BaseResilientService } from '@/services/BaseResilientService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Repositório de Avaliações (Notas, Avaliações Gerais e Educação Infantil)
 */
export class AvaliacaoRepository extends BaseResilientService<any> {
  protected collectionName = 'avaliacoes'; // Nome base, mas este repo gerencia múltiplas tabelas
  protected localTable = localDb.avaliacoes;

  async seedAvaliacoes(turmaId: string, escolaId: string) {
    if (!navigator.onLine) return;

    // 1. Avaliações (Cabeçalhos)
    const qAv = query(
      collection(db, 'avaliacoes'),
      where('escola_id', '==', escolaId),
      where('turma_id', '==', turmaId)
    );
    const snapAv = await getDocs(qAv);
    await localDb.avaliacoes.bulkPut(snapAv.docs.map(d => ({ id: d.id, ...d.data() })));

    // 2. Notas (Valores)
    const qNotas = query(
      collection(db, 'notas'),
      where('turma_id', '==', turmaId)
    );
    const snapNotas = await getDocs(qNotas);
    await localDb.notas.bulkPut(snapNotas.docs.map(d => ({ id: d.id, ...d.data() })));

    // 3. Notas Parciais
    const qParciais = query(
      collection(db, 'notas_parciais'),
      where('turma_id', '==', turmaId)
    );
    const snapParciais = await getDocs(qParciais);
    await localDb.notas_parciais.bulkPut(snapParciais.docs.map(d => ({ id: d.id, ...d.data() })));

    // 4. Educação Infantil
    const qInfantil = query(
      collection(db, 'avaliacoes_infantil'),
      where('turma_id', '==', turmaId)
    );
    const snapInfantil = await getDocs(qInfantil);
    await localDb.avaliacoes_infantil.bulkPut(snapInfantil.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async saveNota(data: any) {
    await localDb.notas.put(data);
    await localDb.sync_queue.add({
      collection: 'notas',
      action: 'update',
      data: data,
      timestamp: Date.now()
    });
  }

  async saveAvaliacaoInfantil(data: any) {
    await localDb.avaliacoes_infantil.put(data);
    await localDb.sync_queue.add({
      collection: 'avaliacoes_infantil',
      action: 'update',
      data: data,
      timestamp: Date.now()
    });
  }

  async saveAvaliacao(data: any) {
    const id = data.id || crypto.randomUUID();
    const payload = { ...data, id };
    await localDb.avaliacoes.put(payload);
    await localDb.sync_queue.add({
      collection: 'avaliacoes',
      action: 'create',
      data: payload,
      timestamp: Date.now()
    });
    return id;
  }

  async updateAvaliacao(id: string, data: any) {
    const payload = { ...data, id };
    await localDb.avaliacoes.put(payload);
    await localDb.sync_queue.add({
      collection: 'avaliacoes',
      action: 'update',
      data: payload,
      timestamp: Date.now()
    });
  }

  async getAvaliacoesByDia(turmaId: string, componente: string, data: string) {
    return await localDb.avaliacoes
      .where({ turma_id: turmaId, componente, data })
      .toArray();
  }

  async getAvaliacoesByTurma(turmaId: string, componente: string) {
    return await localDb.avaliacoes
      .where('turma_id').equals(turmaId)
      .filter(a => a.componente === componente)
      .toArray();
  }

  async getNotasByAvaliacao(avaliacaoId: string) {
    return await localDb.notas.where('avaliacao_id').equals(avaliacaoId).toArray();
  }

  async getAvaliacaoInfantil(turmaId: string, estudanteId: string, dataAvaliacao: string) {
    return await localDb.avaliacoes_infantil
      .where('[turma_id+estudante_id+data_avaliacao]')
      .equals([turmaId, estudanteId, dataAvaliacao])
      .first();
  }

  async getAvaliadosIdsByData(turmaId: string, data: string): Promise<Set<string>> {
    const list = await localDb.avaliacoes_infantil
      .where({ turma_id: turmaId, data_avaliacao: data })
      .toArray();
    return new Set(list.map(a => a.estudante_id));
  }
}

export const avaliacaoRepo = new AvaliacaoRepository();
