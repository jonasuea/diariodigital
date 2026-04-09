import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncService } from '@/services/SyncService';

interface OfflineStatusContextType {
  isOnline: boolean;
  isSyncing: boolean;
}

const OfflineStatusContext = createContext<OfflineStatusContextType>({
  isOnline: navigator.onLine,
  isSyncing: false,
});

export const useOfflineStatus = () => useContext(OfflineStatusContext);

export const OfflineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[OfflineStatus] Rede restabelecida. Iniciando sincronização...');
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[OfflineStatus] Dispositivo offline.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Tenta sincronizar ao montar o componente se estiver online
    if (navigator.onLine) {
      triggerSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await syncService.processQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <OfflineStatusContext.Provider value={{ isOnline, isSyncing }}>
      {children}
    </OfflineStatusContext.Provider>
  );
};
