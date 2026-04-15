import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncService } from '@/services/SyncService';
import { db } from '@/lib/firebase';
import { disableNetwork, enableNetwork } from 'firebase/firestore';

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
    const handleOnline = async () => {
      setIsOnline(true);
      console.log('[OfflineStatus] Rede restabelecida. Ativando Firebase e sincronizando...');
      try {
        await enableNetwork(db);
      } catch (e) {
        console.warn('Erro ao restaurar rede Firebase', e);
      }
      triggerSync();
    };

    const handleOffline = async () => {
      setIsOnline(false);
      console.log('[OfflineStatus] Dispositivo offline. Desativando chamadas Firebase...');
      try {
        await disableNetwork(db);
      } catch (e) {
        console.warn('Erro ao desativar rede Firebase', e);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ajuste inicial de rede
    if (!navigator.onLine) {
      disableNetwork(db).catch(() => {});
    } else {
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
