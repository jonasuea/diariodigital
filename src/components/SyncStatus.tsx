import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '@/lib/db';
import { syncService } from '@/services/SyncService';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => localDb.sync_queue.count(),
    []
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncService.processQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-4 w-4 text-amber-500" />,
        text: 'Modo Offline',
        color: 'text-amber-500',
        description: 'Você está desconectado. As alterações serão salvas localmente e sincronizadas quando houver conexão.'
      };
    }

    if (isSyncing) {
      return {
        icon: <RefreshCw className="h-4 w-4 text-primary animate-spin" />,
        text: 'Sincronizando...',
        color: 'text-primary',
        description: 'Enviando alterações pendentes para o servidor.'
      };
    }

    if (pendingCount && pendingCount > 0) {
      return {
        icon: <RefreshCw className="h-4 w-4 text-blue-500" />,
        text: `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`,
        color: 'text-blue-500',
        description: 'Há alterações salvas localmente aguardando sincronização.'
      };
    }

    return {
      icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
      text: 'Sincronizado',
      color: 'text-emerald-500',
      description: 'Todos os seus dados estão atualizados no servidor.'
    };
  };

  const status = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleSync}
            disabled={!isOnline || isSyncing || (pendingCount === 0)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors transition-all duration-200 active:scale-95",
              status.color
            )}
          >
            {status.icon}
            <span className="text-xs font-medium hidden md:inline">
              {status.text}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <p className="font-semibold mb-1">{isOnline ? 'Conectado' : 'Sem Internet'}</p>
          <p className="text-xs text-muted-foreground">{status.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
