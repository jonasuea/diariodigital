import { localDb } from '@/lib/db';
import { syncService } from './SyncService';
import { Table } from 'dexie';

/**
 * Classe base para serviços que precisam de suporte offline (Resilient Mode).
 */
export abstract class BaseResilientService<T extends { id: string }> {
  protected abstract collectionName: string;
  protected abstract localTable: Table<T, string>;

  /**
   * Salva um registro (Cria ou Atualiza)
   */
  async save(data: T): Promise<void> {
    // 1. Persistência Local Imediata (Fonte da Verdade para a UI)
    await this.localTable.put(data);

    // 2. Registro na Fila de Sincronização
    await localDb.sync_queue.add({
      collection: this.collectionName,
      action: 'update',
      data: data,
      timestamp: Date.now()
    });

    // 3. Trigger de disparada (não aguarda a conclusão para não travar a UI)
    if (navigator.onLine) {
      syncService.processQueue().catch(err => 
        console.error(`[${this.collectionName}] Erro no trigger de sync:`, err)
      );
    }
  }

  /**
   * Exclusão lógica do registro
   */
  async delete(id: string): Promise<void> {
    const item = await this.localTable.get(id);
    
    if (item) {
      // 1. Marca como excluído localmente
      const deletedItem = {
        ...item,
        excluido: true,
        excluido_em: new Date().toISOString()
      };
      await this.localTable.put(deletedItem);

      // 2. Registra na fila para exclusão remota
      await localDb.sync_queue.add({
        collection: this.collectionName,
        action: 'delete',
        data: { id },
        timestamp: Date.now()
      });

      // 3. Trigger
      if (navigator.onLine) {
        syncService.processQueue().catch(err => 
          console.error(`[${this.collectionName}] Erro no trigger de delete sync:`, err)
        );
      }
    }
  }

  /**
   * Busca um registro individual (prioriza local)
   */
  async getById(id: string): Promise<T | undefined> {
    return await this.localTable.get(id);
  }

  /**
   * Limpa os dados locais desta tabela (ex: no logout)
   */
  async clearLocal(): Promise<void> {
    await this.localTable.clear();
  }
}
