/**
 * Script: criarUsuarios.mjs
 * 
 * Cria usuários no Firebase Authentication para todos os cadastrados no Firestore
 * (estudantes, professores e equipe_gestora) que possuam e-mail.
 * 
 * PRÉ-REQUISITOS:
 * 1. Baixar a chave da conta de serviço no Console Firebase:
 *    Configurações do Projeto → Contas de serviço → Gerar nova chave privada
 *    Salvar como: scripts/serviceAccountKey.json
 * 
 * 2. Instalar dependencias (apenas uma vez):
 *    cd scripts && npm init -y && npm install firebase-admin
 *
 * 3. Executar:
 *    node scripts/criarUsuarios.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

const SENHA_PADRAO = 'DIARIODIGITAL2026';

// Mapeia as coleções para os perfis do sistema
const COLECOES = [
    { collectionName: 'estudantes', role: 'estudante' },
    { collectionName: 'professores', role: 'secretario' },
    { collectionName: 'equipe_gestora', role: 'secretario' },
];

let criados = 0;
let jaExistiam = 0;
let semEmail = 0;
let erros = 0;

async function criarUsuario(doc, role) {
    const data = doc.data();
    const email = data.email?.trim();
    const nome = data.nome || data.name || 'Usuário';
    const escolaId = data.escola_id || '';

    if (!email) {
        console.log(`  ⏭  [SEM EMAIL] ${nome}`);
        semEmail++;
        return;
    }

    try {
        // Verifica se o usuário já existe
        let uid;
        try {
            const existingUser = await auth.getUserByEmail(email);
            uid = existingUser.uid;
            console.log(`  ✅ [JÁ EXISTE] ${nome} (${email})`);
            jaExistiam++;
        } catch (notFoundErr) {
            // Usuário não existe — criar
            const newUser = await auth.createUser({
                email: email,
                password: SENHA_PADRAO,
                displayName: nome,
                emailVerified: false,
            });
            uid = newUser.uid;
            console.log(`  🆕 [CRIADO] ${nome} (${email})`);
            criados++;
        }

        // Garante que o perfil (profile) existe no Firestore
        const profileRef = db.collection('profiles').doc(uid);
        const profileSnap = await profileRef.get();
        if (!profileSnap.exists) {
            await profileRef.set({
                nome: nome,
                email: email,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // Garante que o user_role existe
        const roleRef = db.collection('user_roles').doc(uid);
        const roleSnap = await roleRef.get();
        if (!roleSnap.exists) {
            const rolePayload = {
                role: role,
                status: 'ativo',
                email: email,
                escola_id: escolaId,
            };
            // Se tiver array de escolas, inclui também
            if (Array.isArray(data.escolas) && data.escolas.length > 0) {
                rolePayload.escolas = data.escolas;
            } else if (escolaId) {
                rolePayload.escolas = [escolaId];
            }
            await roleRef.set(rolePayload);
        }

    } catch (err) {
        console.error(`  ❌ [ERRO] ${nome} (${email}): ${err.message}`);
        erros++;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('  EducaFácil — Script de Criação de Usuários em Massa');
    console.log('='.repeat(60));

    for (const { collectionName, role } of COLECOES) {
        console.log(`\n📂 Processando: ${collectionName} → perfil: ${role}`);
        const snapshot = await db.collection(collectionName).get();

        for (const doc of snapshot.docs) {
            await criarUsuario(doc, role);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  RESUMO FINAL');
    console.log('='.repeat(60));
    console.log(`  🆕 Criados:     ${criados}`);
    console.log(`  ✅ Já existiam: ${jaExistiam}`);
    console.log(`  ⏭  Sem e-mail:  ${semEmail}`);
    console.log(`  ❌ Erros:       ${erros}`);
    console.log('='.repeat(60));

    process.exit(0);
}

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
