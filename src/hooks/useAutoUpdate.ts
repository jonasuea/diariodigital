import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/constants/version';

export function useAutoUpdate() {
    const [lastCheck, setLastCheck] = useState<number>(Date.now());
    const [hasUpdate, setHasUpdate] = useState(false);
    const [newVersionInfo, setNewVersionInfo] = useState<{ version: string, notes: string } | null>(null);

    const checkUpdate = async () => {
        if (!navigator.onLine) return false;

        try {
            const response = await fetch(`/version.json?t=${Date.now()}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.version && data.version !== APP_VERSION) {
                setHasUpdate(true);
                setNewVersionInfo({ version: data.version, notes: data.notes });
                return true;
            } else {
                setHasUpdate(false);
                setNewVersionInfo(null);
            }
        } catch (error) {
            // Silencia erro de fetch falho por falta de internet
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                return false;
            }
            console.error('Erro ao verificar atualização automática:', error);
        }
        return false;
    };

    const handleApplyUpdate = async () => {
        toast.loading('Limpando cache e atualizando...');
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            window.location.reload();
        } catch (error) {
            console.error('Sem permissão para limpar cache:', error);
            window.location.reload();
        }
    };

    useEffect(() => {
        // Primeira verificação ao carregar
        checkUpdate();

        // Verificações periódicas a cada 30 minutos
        const interval = setInterval(() => {
            checkUpdate();
            setLastCheck(Date.now());
        }, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return { checkUpdate, lastCheck, hasUpdate, newVersionInfo, handleApplyUpdate };
}
