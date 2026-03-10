
import { db } from './src/lib/firebase.ts';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function findMarinete() {
    const q = query(collection(db, 'profiles'), where('nome', '==', 'MARINETE GERALDA DA SILVA'));
    const snap = await getDocs(q);

    if (snap.empty) {
        console.log("Marinete not found in profiles");
        return;
    }

    for (const d of snap.docs) {
        const data = d.data();
        const roleSnap = await getDocs(query(collection(db, 'user_roles'), where('__name__', '==', d.id)));
        const role = roleSnap.docs[0]?.data()?.role || 'no role';
        console.log(`UID: ${d.id}, Name: ${data.nome}, Current Role: ${role}`);
    }
}

findMarinete();
