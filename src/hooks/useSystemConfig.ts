import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
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

export function useSystemConfig() {
    const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ref = doc(db, 'configuracoes', 'sistema');
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (snap.exists()) {
                    setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as SystemConfig);
                } else {
                    setConfig(DEFAULT_CONFIG);
                }
                setLoading(false);
            },
            () => {
                setConfig(DEFAULT_CONFIG);
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    return { config, loading };
}
