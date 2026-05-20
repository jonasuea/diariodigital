import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UseFirestoreListOptions {
  collectionName: string;
  pageSize?: number;
  sortBy?: string;
  escolaScoped?: boolean;
  escolaAtivaId?: string | null;
}

export function useFirestoreList<T>({
  collectionName,
  pageSize = 20,
  sortBy = 'nome',
  escolaScoped = true,
  escolaAtivaId
}: UseFirestoreListOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchData = useCallback(async (next = false) => {
    setLoading(true);
    try {
      const searchLower = search.trim().toLowerCase();
      const qConstraints: QueryConstraint[] = [
        where('excluido', '==', showDeleted)
      ];

      if (escolaScoped && escolaAtivaId) {
        qConstraints.push(where('escola_id', '==', escolaAtivaId));
      }

      // Firestore query search by prefix logic
      if (searchLower) {
        // We assume search matches against a name_lower or similar normalized search field if available,
        // or search by 'nome' prefix. We will query 'nome' (case-sensitive prefix) or fallback logic.
        // For broad compatibility, we match on standard 'nome' prefix.
        qConstraints.push(where('nome', '>=', search));
        qConstraints.push(where('nome', '<=', search + '\uf8ff'));
        qConstraints.push(orderBy('nome'));
      } else {
        qConstraints.push(orderBy(sortBy));
      }

      qConstraints.push(limit(pageSize + 1));

      if (next && lastVisible) {
        qConstraints.push(startAfter(lastVisible));
      }

      const baseQuery = query(collection(db, collectionName), ...qConstraints);
      const snap = await getDocs(baseQuery);
      const docs = snap.docs;

      const hasNext = docs.length > pageSize;
      const displayDocs = hasNext ? docs.slice(0, pageSize) : docs;
      setHasMore(hasNext);
      
      if (displayDocs.length > 0) {
        setLastVisible(displayDocs[displayDocs.length - 1]);
      }

      const mapped = displayDocs.map(d => ({ id: d.id, ...d.data() }) as unknown as T);
      setData(prev => next ? [...prev, ...mapped] : mapped);
      if (!next) setPage(1);
    } catch (error) {
      console.error(`Erro ao buscar dados da coleção ${collectionName}:`, error);
    } finally {
      setLoading(false);
    }
  }, [collectionName, pageSize, sortBy, escolaScoped, escolaAtivaId, search, showDeleted, lastVisible]);

  useEffect(() => {
    fetchData();
  }, [search, showDeleted, escolaAtivaId]);

  return {
    data,
    loading,
    search,
    setSearch,
    showDeleted,
    setShowDeleted,
    page,
    hasMore,
    handleNextPage: () => { setPage(p => p + 1); fetchData(true); },
    handleReset: () => { setPage(1); fetchData(); },
    refresh: () => fetchData()
  };
}
