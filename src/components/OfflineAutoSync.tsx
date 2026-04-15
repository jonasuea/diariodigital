import { useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { offlinePrefetchService } from '@/services/OfflinePrefetchService';
import { useOfflineStatus } from '@/contexts/OfflineStatusContext';

export function OfflineAutoSync() {
  const { escolaAtivaId } = useUserRole();
  const { isOnline } = useOfflineStatus();

  useEffect(() => {
    if (isOnline && escolaAtivaId) {
      offlinePrefetchService.prefetchData(escolaAtivaId);
    }
  }, [isOnline, escolaAtivaId]);

  return null;
}
