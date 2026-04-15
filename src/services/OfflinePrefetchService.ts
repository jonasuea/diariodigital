import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { localDb } from '@/lib/db';

class OfflinePrefetchService {
  private isPrefetching = false;

  async prefetchData(escolaId?: string) {
    // Evita chamadas concorrentes
    if (this.isPrefetching) return;
    
    // Verifica a configuração
    const stored = localStorage.getItem('sincronizacaoOffline');
    if (stored !== 'true' || !navigator.onLine) {
      return; 
    }

    this.isPrefetching = true;
    console.log('[OfflinePrefetch] Iniciando download de dependências e dados locais...');

    try {
      // 1. Sincronizar Coleções Essenciais (Turmas, Estudantes)
      // Se não houver escolaId explícito na action, buscaremos sem filtro ou com base no perfil. 
      // Mas recomendado é sincronizar as coleções básicas que listamos.
      const collectionsToCache = ['turmas', 'estudantes', 'eventos', 'dias_letivos', 'horarios', 'professores'];

      for (const colName of collectionsToCache) {
        try {
          const colRef = escolaId 
            ? query(collection(db, colName), where('escola_id', '==', escolaId))
            : collection(db, colName); // Fallback caso o sistema tenha controle global
            
          const snap = await getDocs(colRef);
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

          if (data.length > 0) {
            // @ts-ignore
            await localDb[colName].bulkPut(data);
          }
        } catch (error) {
          console.warn(`[OfflinePrefetch] Erro ao sincronizar coleção ${colName}:`, error);
        }
      }

      console.log('[OfflinePrefetch] Sincronização concluída com sucesso.');
    } finally {
      this.isPrefetching = false;
    }
  }
}

export const offlinePrefetchService = new OfflinePrefetchService();
