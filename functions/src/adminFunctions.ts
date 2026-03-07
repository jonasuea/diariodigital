import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = getFirestore(admin.app(), "database");

/**
 * Cria uma conta de usuário completa (Auth + Profile + UserRole)
 * Chamável apenas por usuários autenticados com papel de 'admin'.
 */
export const createUserAccount = functions.https.onCall(async (request) => {
    // 1. Verificação de permissão (apenas Admin pode criar usuários via sistema)
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const callerUid = request.auth.uid;
    const callerRoleDoc = await db.collection("user_roles").doc(callerUid).get();
    const callerRole = callerRoleDoc.data()?.role;

    if (callerRole !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem criar contas.");
    }

    const { email, password, nome, role, escola_id } = request.data;

    if (!email || !password || !nome || !role) {
        throw new functions.https.HttpsError("invalid-argument", "Dados insuficientes para criação.");
    }

    try {
        let uid: string;
        try {
            // 2. Criar no Firebase Auth
            const userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: nome,
            });
            uid = userRecord.uid;
        } catch (authError: any) {
            if (authError.code === "auth/email-already-in-use") {
                const existingUser = await admin.auth().getUserByEmail(email);
                uid = existingUser.uid;
                console.log(`Usuário ${email} já existe no Auth. Recuperando UID: ${uid}`);
            } else {
                throw authError;
            }
        }

        // 3. Criar Profile e UserRole de forma atômica (Merge para não sobrescrever se já existir)
        const batch = db.batch();

        const profileRef = db.collection("profiles").doc(uid);
        batch.set(profileRef, {
            nome,
            email,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            excluido: false,
        }, { merge: true });

        const roleRef = db.collection("user_roles").doc(uid);
        batch.set(roleRef, {
            role,
            status: "ativo",
            email,
            escola_id: escola_id || "",
            escolas: escola_id ? [escola_id] : [],
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            excluido: false,
        }, { merge: true });

        await batch.commit();

        return { success: true, uid };
    } catch (error: any) {
        console.error("Erro ao criar/recuperar usuário:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Vincula um professor a uma turma validando a escola.
 */
export const assignTeacherToTurma = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Autenticação necessária.");
    }

    const { professorId, turmaId, escolaId } = request.data;

    try {
        const turmaDoc = await db.collection("turmas").doc(turmaId).get();
        const profDoc = await db.collection("professores").doc(professorId).get();

        if (!turmaDoc.exists || !profDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Turma ou Professor não encontrado.");
        }

        if (turmaDoc.data()?.escola_id !== escolaId || profDoc.data()?.escola_id !== escolaId) {
            throw new functions.https.HttpsError("permission-denied", "Conflito de escola detectado.");
        }

        await db.collection("turmas").doc(turmaId).update({
            professoresIds: admin.firestore.FieldValue.arrayUnion(professorId),
        });

        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
