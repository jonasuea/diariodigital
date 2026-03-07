"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTeacherToTurma = exports.createUserAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = (0, firestore_1.getFirestore)(admin.app(), "database");
exports.createUserAccount = functions.https.onCall(async (request) => {
    var _a;
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const callerUid = request.auth.uid;
    const callerRoleDoc = await db.collection("user_roles").doc(callerUid).get();
    const callerRole = (_a = callerRoleDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (callerRole !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem criar contas.");
    }
    const { email, password, nome, role, escola_id } = request.data;
    if (!email || !password || !nome || !role) {
        throw new functions.https.HttpsError("invalid-argument", "Dados insuficientes para criação.");
    }
    try {
        let uid;
        try {
            const userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: nome,
            });
            uid = userRecord.uid;
        }
        catch (authError) {
            if (authError.code === "auth/email-already-in-use") {
                const existingUser = await admin.auth().getUserByEmail(email);
                uid = existingUser.uid;
                console.log(`Usuário ${email} já existe no Auth. Recuperando UID: ${uid}`);
            }
            else {
                throw authError;
            }
        }
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
    }
    catch (error) {
        console.error("Erro ao criar/recuperar usuário:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.assignTeacherToTurma = functions.https.onCall(async (request) => {
    var _a, _b;
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
        if (((_a = turmaDoc.data()) === null || _a === void 0 ? void 0 : _a.escola_id) !== escolaId || ((_b = profDoc.data()) === null || _b === void 0 ? void 0 : _b.escola_id) !== escolaId) {
            throw new functions.https.HttpsError("permission-denied", "Conflito de escola detectado.");
        }
        await db.collection("turmas").doc(turmaId).update({
            professoresIds: admin.firestore.FieldValue.arrayUnion(professorId),
        });
        return { success: true };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=adminFunctions.js.map