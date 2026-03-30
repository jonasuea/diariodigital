import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SystemConfig {
    manutencao: boolean;
    matriculas_abertas: boolean;
    manutencao_mensagem: string;
    matriculas_fechadas_msg: string;
}

const DEFAULT_CONFIG: SystemConfig = {
    manutencao: false,
    matriculas_abertas: true,
    manutencao_mensagem: 'Sistema em manutenção. Retornaremos em breve.',
    matriculas_fechadas_msg: 'O período de matrículas está encerrado. Aguarde a abertura.',
};

let configCache: SystemConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function useSystemConfig() {
    const [config, setConfig] = useState<SystemConfig>(configCache ?? DEFAULT_CONFIG);
    const [loading, setLoading] = useState(!configCache);

    useEffect(() => {
        const now = Date.now();
        if (configCache && now - cacheTimestamp < CACHE_TTL_MS) {
            setConfig(configCache);
            setLoading(false);
            return;
        }

        let cancelled = false;
        async function fetchConfig() {
            try {
                const ref = doc(db, 'configuracoes', 'sistema');
                const snap = await getDoc(ref);
                if (cancelled) return;
                const data = snap.exists()
                    ? ({ ...DEFAULT_CONFIG, ...snap.data() } as SystemConfig)
                    : DEFAULT_CONFIG;
                configCache = data;
                cacheTimestamp = Date.now();
                setConfig(data);
            } catch {
                if (!cancelled) setConfig(DEFAULT_CONFIG);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchConfig();
        return () => { cancelled = true; };
    }, []);

    return { config, loading };
}
