import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/constants/version';

export function useAutoUpdate() {
    const [lastCheck, setLastCheck] = useState<number>(Date.now());

    const checkUpdate = async () => {
        try {
            // Adicionamos um timestamp para evitar cache agressivo do navegador
            const response = await fetch(`/version.json?t=${Date.now()}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.version && data.version !== APP_VERSION) {
                toast.info(`Nova versão ${data.version} disponível!`, {
                    description: data.notes || "Atualização do sistema disponível.",
                    duration: Infinity,
                    action: {
                        label: "Atualizar Agora",
                        onClick: () => {
                            handleApplyUpdate();
                        },
                    },
                });
                return true;
            }
        } catch (error) {
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
            console.error('Erro ao limpar cache:', error);
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

    return { checkUpdate, lastCheck };
}
