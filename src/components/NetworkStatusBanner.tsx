import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-amber-500 text-white shadow-md select-none animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-center justify-center p-2.5 px-4 text-sm font-medium">
        <WifiOff className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate">
          Você está trabalhando offline. Seus dados serão salvos localmente e sincronizados assim que houver conexão.
        </span>
        <ShieldAlert className="w-4 h-4 ml-2 flex-shrink-0 opacity-70 hidden sm:block" />
      </div>
    </div>
  );
}
