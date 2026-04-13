import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
};

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Register service worker with auto-update
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      toast.success('Aplicativo instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if app is running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (needRefresh) {
      toast('Nova versão disponível!', {
        description: 'Deseja atualizar agora para obter as melhorias mais recentes?',
        action: {
          label: 'Atualizar',
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity,
      });
    }

    if (offlineReady) {
      toast.success('App pronto para uso offline!');
      setOfflineReady(false);
    }
  }, [needRefresh, offlineReady, updateServiceWorker, setOfflineReady]);

  const installApp = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if browser supports PWA installation
    if ('BeforeInstallPromptEvent' in window || (window as any).BeforeInstallPromptEvent) {
      setIsSupported(true);
    } else {
      // Logic for iOS or browsers that don't fire the event
      setIsSupported(true); // We'll show manual instructions anyway
    }
  }, []);

  return {
    isInstallable: !!installPrompt,
    isSupported,
    isStandalone,
    installApp,
    needRefresh,
    updateServiceWorker
  };
}
