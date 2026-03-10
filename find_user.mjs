
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAZVhX8khBhgbzpntqt5BG8hC880dxs9u0",
    authDomain: "educafacil1.firebaseapp.com",
    projectId: "educafacil1",
    storageBucket: "educafacil1.firebasestorage.app",
    messagingSenderId: "887663510530",
    appId: "1:887663510530:web:3d3b44cf249748e1a9d31b",
    measurementId: "G-CYSGVFF2TQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'database');

async function run() {
    const snap = await getDocs(collection(db, 'profiles'));

    console.log(`Searching through ${snap.size} profiles...`);

    for (const d of snap.docs) {
        const nome = d.data().nome || "";
        if (nome.includes('MARINETE')) {
            const roleRef = doc(db, 'user_roles', d.id);
            const roleSnap = await getDoc(roleRef);
            console.log(`---
UID: ${d.id}
Name: ${nome}
Role in user_roles: ${roleSnap.data()?.role || 'NOT SET'}
---`);
        }
    }
}

run().catch(console.error);
