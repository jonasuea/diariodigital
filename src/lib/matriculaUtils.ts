import { db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';

export async function generateMatricula(prefix: string = 'EST', counterDoc: string = 'estudantes'): Promise<string> {
    const counterRef = doc(db, 'counters', counterDoc);

    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterDocument = await transaction.get(counterRef);

            let lastValue = 0;
            if (counterDocument.exists()) {
                lastValue = counterDocument.data()?.lastValue || 0;
            }

            const nextValue = lastValue + 1;

            if (!counterDocument.exists()) {
                transaction.set(counterRef, { lastValue: nextValue });
            } else {
                transaction.update(counterRef, { lastValue: nextValue });
            }

            return nextValue;
        });

        return `${prefix}${newId}`;
    } catch (error) {
        console.error("Erro ao gerar matrícula automática:", error);
        throw error;
    }
}

export async function generateMatriculasBatch(count: number, prefix: string = 'EST', counterDoc: string = 'estudantes'): Promise<string[]> {
    if (count <= 0) return [];

    const counterRef = doc(db, 'counters', counterDoc);

    try {
        const { startValue, endValue } = await runTransaction(db, async (transaction) => {
            const counterDocument = await transaction.get(counterRef);

            let lastValue = 0;
            if (counterDocument.exists()) {
                lastValue = counterDocument.data()?.lastValue || 0;
            }

            const currentStartValue = lastValue + 1;
            const currentEndValue = lastValue + count;

            if (!counterDocument.exists()) {
                transaction.set(counterRef, { lastValue: currentEndValue });
            } else {
                transaction.update(counterRef, { lastValue: currentEndValue });
            }

            return { startValue: currentStartValue, endValue: currentEndValue };
        });

        const matriculas: string[] = [];
        for (let i = startValue; i <= endValue; i++) {
            matriculas.push(`${prefix}${i}`);
        }

        return matriculas;
    } catch (error) {
        console.error("Erro ao gerar lote de matrículas:", error);
        throw error;
    }
}
