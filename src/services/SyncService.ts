import { localDb, SyncOperation } from '@/lib/db';
import { FirebaseFacade } from '@/facades/FirebaseFacade';

class SyncService {
  private isSyncing = false;

  /**
   * Processa a fila de sincronização pendente.
   */
  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;

    this.isSyncing = true;
    try {
      const pendingOperations = await localDb.sync_queue.orderBy('timestamp').toArray();
      
      if (pendingOperations.length === 0) return;

      for (const op of pendingOperations) {
        try {
          await this.syncItem(op);
          await localDb.sync_queue.delete(op.id!);
        } catch (error: any) {
          console.error(`[SyncService] Erro ao sincronizar item ${op.id}:`, error);
          
          // Se for erro de permissão (403), talvez devêssemos remover da fila ou marcar para intervenção
          if (error.code === 'permission-denied') {
            console.error(`[SyncService] Permissão negada para ${op.collection}/${op.data.id}. Item removido da fila.`);
            await localDb.sync_queue.delete(op.id!);
            continue;
          }

          // Para outros erros (ex: rede caiu no meio), interrompemos o loop para tentar mais tarde
          break; 
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Executa uma única operação no Firestore.
   */
  private async syncItem(op: SyncOperation) {
    const { collection: colName, action, data } = op;
    
    // Todas as tabelas no diariodigital usam 'id' como chave primária
    if (!data.id) {
      throw new Error(`Item da coleção ${colName} sem ID para sincronização.`);
    }

    switch (action) {
      case 'create':
      case 'update':
        // Usamos merge: true para garantir que não sobrescreveremos campos parciais se houver conflito
        await FirebaseFacade.setDocument(colName, data.id, {
          ...data,
          last_sync: new Date().toISOString()
        }, true);
        break;

      case 'delete':
        // No diariodigital, seguimos o padrão de exclusão lógica (Soft Delete)
        await FirebaseFacade.updateDocument(colName, data.id, {
          excluido: true,
          excluido_em: new Date().toISOString(),
          excluido_por_sync: true
        });
        break;
    }
  }
}

export const syncService = new SyncService();

