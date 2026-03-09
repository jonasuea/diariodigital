import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

// Tentativa de inicializar sem chave explícita (pode funcionar se houver login no CLI)
admin.initializeApp({
    projectId: 'educafacil1'
});

const db = admin.firestore();

async function fixEquipeGestora() {
    console.log('--- Iniciando correção da equipe_gestora ---');
    const snapshot = await db.collection('equipe_gestora').get();

    let total = 0;
    let atualizados = 0;

    for (const doc of snapshot.docs) {
        total++;
        const data = doc.data();

        if (data.excluido === undefined) {
            console.log(`Updating doc ${doc.id} (${data.nome || 'Sem nome'})`);
            await doc.ref.update({ excluido: false });
            atualizados++;
        }
    }

    console.log(`--- Fim ---`);
    console.log(`Total de documentos: ${total}`);
    console.log(`Documentos atualizados: ${atualizados}`);
}

fixEquipeGestora()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Erro:', err);
        process.exit(1);
    });
