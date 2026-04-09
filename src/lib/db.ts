import Dexie, { Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  collection: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export class OfflineDB extends Dexie {
  // Infraestrutura e Cadastros
  turmas!: Table<any>;
  estudantes!: Table<any>;
  dias_letivos!: Table<any>;
  base_curricular!: Table<any>;
  eventos!: Table<any>;

  // Registros Pedagógicos
  frequencias!: Table<any>;
  entradas_diario!: Table<any>;
  registros_aulas!: Table<any>;
  avaliacoes!: Table<any>;
  notas!: Table<any>;
  notas_parciais!: Table<any>;
  avaliacoes_infantil!: Table<any>;

  // Sincronização
  sync_queue!: Table<SyncOperation>;

  constructor() {
    super('DiarioDigitalDB');
    this.version(1).stores({
      turmas: 'id, escola_id',
      estudantes: 'id, turma_id, escola_id',
      dias_letivos: 'id, data, escola_id',
      base_curricular: 'id, componente, *serie',
      eventos: 'id, data, escola_id',
      
      frequencias: 'id, [estudante_id+data], turma_id',
      entradas_diario: 'id, [turma_id+data]',
      registros_aulas: 'id, [turma_id+data+componente]',
      avaliacoes: 'id, turma_id',
      notas: 'id, avaliacao_id, estudante_id',
      notas_parciais: 'id, turma_id, estudante_id',
      avaliacoes_infantil: 'id, [turma_id+estudante_id+data_avaliacao]',
      
      sync_queue: '++id, timestamp'
    });
  }
}

export const localDb = new OfflineDB();
