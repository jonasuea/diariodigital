import React from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface OfflineIndicatorProps {
  isSyncing: boolean;
  progress: number;
  lastSync: string | null;
  onSync: () => void;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  isSyncing, 
  progress, 
  lastSync, 
  onSync,
  className 
}) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Nunca sincronizado';
    const date = new Date(iso);
    return `Sincronizado em ${date.toLocaleDateString()} às ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className={cn("flex flex-col gap-1 items-end", className)}>
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
            <CloudOff className="h-3.5 w-3.5" />
            MODO OFFLINE
          </div>
        ) : isSyncing ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            SINCRONIZANDO {progress}%
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            PRONTO PARA USO OFFLINE
          </div>
        )}

        {isOnline && !isSyncing && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-primary" 
            onClick={onSync}
            title="Sincronizar dados agora"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground italic mr-1">
        {formatLastSync(lastSync)}
      </span>
    </div>
  );
};
