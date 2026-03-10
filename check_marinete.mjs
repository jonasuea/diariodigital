import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAZVhX8khBhgbzpntqt5BG8hC880dxs9u0",
    authDomain: "educafacil1.firebaseapp.com",
    projectId: "educafacil1",
    storageBucket: "educafacil1.firebasestorage.app",
    messagingSenderId: "887663510530",
    appId: "1:887663510530:web:3d3b44cf249748e1a9d31b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'database');

async function runDiagnosis() {
    console.log("--- Buscando Marinete na coleção 'estudantes' ---");
    const snap = await getDocs(collection(db, 'estudantes'));
    const matches = snap.docs.filter(d => {
        const data = d.data();
        return (data.pai_nome || "").toUpperCase().includes("MARINETE") ||
            (data.mae_nome || "").toUpperCase().includes("MARINETE") ||
            (data.responsavel_nome || "").toUpperCase().includes("MARINETE");
    });

    console.log(`Encontrados ${matches.length} estudantes vinculados:`);
    for (const d of matches) {
        const data = d.data();
        console.log(`- Estudante: ${data.nome}`);
        console.log(`  Pai: ${data.pai_nome} (CPF: ${data.pai_cpf})`);
        console.log(`  Mãe: ${data.mae_nome} (CPF: ${data.mae_cpf})`);
        console.log(`  Responsável: ${data.responsavel_nome} (CPF: ${data.responsavel_cpf})`);
        console.log(`  usuário_id (se houver): ${data.usuario_id || "N/A"}`);
        console.log("-----------------------------------");
    }
}

runDiagnosis().catch(console.error);
