import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";




if (!admin.apps.length) {
    admin.initializeApp();
}

const db = getFirestore(admin.app(), "database");

/**
 * Formata um CPF para o padrão XXX.XXX.XXX-XX
 */
function formatToCPF(cpf: string) {
    const numbers = cpf.replace(/\D/g, "");
    if (numbers.length !== 11) return numbers;
    return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Cria uma conta de usuário completa (Auth + Profile + UserRole)
 * Chamável apenas por usuários autenticados com papel de 'admin'.
 */
export const createUserAccount = onCall(async (request) => {
    // 1. Verificação de permissão (apenas Admin pode criar usuários via sistema)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const callerUid = request.auth.uid;
    const callerRoleDoc = await db.collection("user_roles").doc(callerUid).get();
    const callerRole = callerRoleDoc.data()?.role;

    if (callerRole !== "admin") {
        throw new HttpsError("permission-denied", "Apenas administradores podem criar contas.");
    }

    const { email, password, nome, role, escola_id } = request.data;

    if (!email || !password || !nome || !role) {
        throw new HttpsError("invalid-argument", "Dados insuficientes para criação.");
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
            created_at: FieldValue.serverTimestamp(),

            excluido: false,
        }, { merge: true });

        const roleRef = db.collection("user_roles").doc(uid);
        batch.set(roleRef, {
            role,
            status: "ativo",
            email,
            escola_id: escola_id || "",
            escolas: escola_id ? [escola_id] : [],
            updated_at: FieldValue.serverTimestamp(),

            excluido: false,
        }, { merge: true });

        await batch.commit();

        return { success: true, uid };
    } catch (error: any) {
        console.error("Erro ao criar/recuperar usuário:", error);
        throw new HttpsError("internal", error.message);
    }
});



/**
 * Vincula um professor a uma turma validando a escola.
 */
export const assignTeacherToTurma = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Autenticação necessária.");
    }

    const { professorId, turmaId, escolaId } = request.data;

    try {
        const turmaDoc = await db.collection("turmas").doc(turmaId).get();
        const profDoc = await db.collection("professores").doc(professorId).get();

        if (!turmaDoc.exists || !profDoc.exists) {
            throw new HttpsError("not-found", "Turma ou Professor não encontrado.");
        }

        if (turmaDoc.data()?.escola_id !== escolaId || profDoc.data()?.escola_id !== escolaId) {
            throw new HttpsError("permission-denied", "Conflito de escola detectado.");
        }


        await db.collection("turmas").doc(turmaId).update({
            professoresIds: FieldValue.arrayUnion(professorId),

        });

        return { success: true };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Consulta o status de matrícula de um estudante pelo CPF.
 * Aberto para chamada sem autenticação (pelo portal público).
 */
export const checkEnrollmentStatus = onCall(async (request) => {
    const { cpf } = request.data;
    if (!cpf) {
        throw new HttpsError("invalid-argument", "CPF é obrigatório.");
    }

    try {
        const studentQuery = await db.collection("estudantes")
            .where("cpf", "==", cpf)
            .where("status", "==", "Frequentando")
            .limit(1)
            .get();

        if (studentQuery.empty) {
            return { found: false };
        }

        const student = studentQuery.docs[0].data();
        let escolaNome = "Escola não identificada";
        let turmaNome = "A definir";

        if (student.escola_id) {
            const escolaDoc = await db.collection("configuracoes").doc("escola").get();
            if (escolaDoc.exists) {
                const config = escolaDoc.data()?.escolaConfig;
                if (config && config.nome) escolaNome = config.nome;
            }
        }

        if (student.turma_id) {
            const turmaDoc = await db.collection("turmas").doc(student.turma_id).get();
            if (turmaDoc.exists) {
                turmaNome = turmaDoc.data()?.nome || "A definir";
            }
        }


        return {
            found: true,
            estudante: {
                nome: student.nome,
                escola: escolaNome,
                turma: turmaNome,
                turno: student.turno || "Não informado"
            }
        };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Registra uma pré-matrícula (reserva de vaga).
 * Aberto para chamada sem autenticação.
 */
export const submitReservation = onCall(async (request) => {
    const data = request.data;
    const required = ["cpf", "nome", "sexo", "endereco", "responsavel_nome"];

    for (const field of required) {
        if (!data[field]) {
            throw new HttpsError("invalid-argument", `Campo '${field}' é obrigatório.`);
        }
    }

    try {
        // Define expiração: 5 dias úteis (aproximadamente 7 dias corridos)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);

        const reservation = {
            ...data,
            status: "pendente",
            data_criacao: FieldValue.serverTimestamp(),
            data_expiracao: Timestamp.fromDate(expirationDate),
            excluido: false
        };


        const docRef = await db.collection("pre_matriculas").add(reservation);
        return { success: true, id: docRef.id, data_expiracao: expirationDate.toISOString() };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Função agendada para limpar reservas expiradas.
 * Roda todos os dias às 00:00.
 */
export const cleanupExpiredReservations = onSchedule("0 0 * * *", async (event) => {
    const now = Timestamp.now();


    try {
        const expiredQuery = await db.collection("pre_matriculas")
            .where("status", "==", "pendente")
            .where("data_expiracao", "<=", now)
            .get();

        if (expiredQuery.empty) {
            console.log("Nenhuma reserva expirada para limpar.");
            return;
        }

        const batch = db.batch();
        expiredQuery.docs.forEach(doc => {
            // Em vez de deletar fisicamente, marcamos como expirada para histórico
            batch.update(doc.ref, {
                status: "expirada",
                updated_at: FieldValue.serverTimestamp()

            });
        });

        await batch.commit();
        console.log(`${expiredQuery.size} reservas foram marcadas como expiradas.`);
    } catch (error) {
        console.error("Erro ao limpar reservas expiradas:", error);
    }
});

export const checkResponsibleByCPF = onCall(async (request) => {
    const { cpf } = request.data;
    if (!cpf) {
        throw new HttpsError("invalid-argument", "CPF é obrigatório.");
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    const formattedCPF = formatToCPF(cleanCPF);

    try {
        // 1. Buscar primeiro no Perfil pelo CPF (melhor fonte da verdade)
        let profileQuery = await db.collection("profiles")
            .where("cpf", "==", cleanCPF)
            .limit(1)
            .get();

        let profileData = !profileQuery.empty ? profileQuery.docs[0].data() : null;

        // 2. Buscar nos estudantes pelo CPF do responsável (tentando ambos os formatos)
        let studentQuery = await db.collection("estudantes")
            .where("responsavel_cpf", "==", cleanCPF)
            .limit(1)
            .get();

        if (studentQuery.empty && formattedCPF !== cleanCPF) {
            studentQuery = await db.collection("estudantes")
                .where("responsavel_cpf", "==", formattedCPF)
                .limit(1)
                .get();
        }

        if (studentQuery.empty && !profileData) {
            return { exists: false };
        }

        const studentData = !studentQuery.empty ? studentQuery.docs[0].data() : {};
        const email = profileData?.email || studentData.responsavel_email || "";
        const exists = true;
        const hasEmail = !!email;

        // 3. Verificar se já existe um usuário (Auth/UserRole) com esse e-mail
        let canRecoverPassword = false;
        if (hasEmail) {
            try {
                const userRecord = await admin.auth().getUserByEmail(email.toLowerCase());
                if (userRecord) {
                    canRecoverPassword = true;
                }
            } catch (e) {
                // Usuário não existe no Auth
            }
        }

        return {
            exists,
            hasEmail,
            email: email,
            canRecoverPassword,
            data: {
                nome: profileData?.nome || studentData.responsavel_nome || "",
                contato: profileData?.contato || studentData.responsavel_contato || "",
                rg: studentData.responsavel_rg || "",
                relacao: studentData.responsavel_relacao || ""
            }
        };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Sincroniza os dados do responsável em todas as ocorrências de seu CPF
 * (estudantes e pre_matriculas).
 */
export const syncResponsibleData = onCall(async (request) => {
    const { cpf, nome, email, telefone } = request.data;

    const cleanCPF = cpf.replace(/\D/g, "");
    const formattedCPF = formatToCPF(cleanCPF);

    console.log(`Iniciando sincronização para o CPF: ${cleanCPF} (${formattedCPF})`);

    try {
        const batch = db.batch();
        let updatedCount = 0;

        // 1. Atualizar na coleção de estudantes (tentando ambos os formatos)
        const studentQuery = await db.collection("estudantes")
            .where("responsavel_cpf", "in", [cleanCPF, formattedCPF])
            .get();

        console.log(`Encontrados ${studentQuery.size} estudantes para o CPF.`);

        studentQuery.docs.forEach(doc => {
            batch.update(doc.ref, {
                responsavel_nome: nome || doc.data().responsavel_nome,
                responsavel_email: email ? email.trim().toLowerCase() : doc.data().responsavel_email,
                responsavel_contato: telefone || doc.data().responsavel_contato,
                updated_at: FieldValue.serverTimestamp()
            });
            updatedCount++;
        });

        // 2. Atualizar na coleção de pré-matrículas (tentando ambos os formatos)
        const preMatriculaQuery = await db.collection("pre_matriculas")
            .where("responsavel_cpf", "in", [cleanCPF, formattedCPF])
            .get();

        console.log(`Encontradas ${preMatriculaQuery.size} pré-matrículas para o CPF.`);

        preMatriculaQuery.docs.forEach(doc => {
            batch.update(doc.ref, {
                responsavel_nome: nome || doc.data().responsavel_nome,
                responsavel_email: email ? email.trim().toLowerCase() : doc.data().responsavel_email,
                responsavel_contato: telefone || doc.data().responsavel_contato,
                updated_at: FieldValue.serverTimestamp()
            });
            updatedCount++;
        });

        if (updatedCount > 0) {
            console.log(`Commitando batch com ${updatedCount} atualizações.`);
            await batch.commit();
        }

        // 3. Verificar se o responsável já tem conta Auth, se não, criar uma.
        let accountStatus = "existing";
        const targetEmail = email?.trim().toLowerCase();

        if (targetEmail) {
            try {
                // Tenta buscar no Auth
                const userRecord = await admin.auth().getUserByEmail(targetEmail);
                const uid = userRecord.uid;

                const updateProfileBatch = db.batch();

                // 1. Garantir que user_roles existe
                const userRolesDoc = await db.collection("user_roles").doc(uid).get();
                if (!userRolesDoc.exists) {
                    updateProfileBatch.set(db.collection("user_roles").doc(uid), {
                        role: "responsavel",
                        email: targetEmail,
                        created_at: FieldValue.serverTimestamp(),
                        updated_at: FieldValue.serverTimestamp()
                    });
                } else if (userRolesDoc.data()?.role !== 'responsavel' && userRolesDoc.data()?.role !== 'admin') {
                    // Se já existir mas não for responsável nem admin, "promove" a responsável
                    updateProfileBatch.update(db.collection("user_roles").doc(uid), {
                        role: "responsavel",
                        updated_at: FieldValue.serverTimestamp()
                    });
                }

                // 2. Garantir que Profile existe e está atualizado
                const profileDoc = await db.collection("profiles").doc(uid).get();
                if (!profileDoc.exists) {
                    updateProfileBatch.set(db.collection("profiles").doc(uid), {
                        nome: nome,
                        email: targetEmail,
                        role: "responsavel",
                        cpf: cleanCPF,
                        created_at: FieldValue.serverTimestamp(),
                        updated_at: FieldValue.serverTimestamp()
                    });
                } else {
                    updateProfileBatch.update(db.collection("profiles").doc(uid), {
                        nome: nome || profileDoc.data()?.nome,
                        contato: telefone || profileDoc.data()?.contato,
                        cpf: cleanCPF || profileDoc.data()?.cpf,
                        updated_at: FieldValue.serverTimestamp()
                    });
                }

                // 3. Garantir Custom Claims
                const currentClaims = userRecord.customClaims || {};
                if (currentClaims.role !== 'responsavel' && currentClaims.role !== 'admin') {
                    await admin.auth().setCustomUserClaims(uid, { ...currentClaims, role: "responsavel" });
                }

                // 4. Atualizar displayName no Auth
                if (nome && userRecord.displayName !== nome) {
                    await admin.auth().updateUser(uid, {
                        displayName: nome
                    });
                }

                // 5. Vincular estudantes a este UID
                const studentsToLink = await db.collection("estudantes")
                    .where("responsavel_cpf", "in", [cleanCPF, formattedCPF])
                    .get();

                studentsToLink.docs.forEach(doc => {
                    if (doc.data().usuario_id !== uid) {
                        updateProfileBatch.update(doc.ref, {
                            usuario_id: uid,
                            updated_at: FieldValue.serverTimestamp()
                        });
                    }
                });

                await updateProfileBatch.commit();
            } catch (e: any) {
                // Se não existir, cria a conta com a senha padrão
                if (e.code === "auth/user-not-found") {
                    const tempPassword = "EDUCAFACIL2026";
                    const userRecord = await admin.auth().createUser({
                        email: targetEmail,
                        password: tempPassword,
                        displayName: nome,
                    });

                    const uid = userRecord.uid;

                    // Definir Claims de Responsável
                    await admin.auth().setCustomUserClaims(uid, { role: "responsavel" });

                    // Criar documentos de papel e perfil
                    const newBatch = db.batch();

                    newBatch.set(db.collection("user_roles").doc(uid), {
                        role: "responsavel",
                        email: targetEmail,
                        created_at: FieldValue.serverTimestamp(),
                        updated_at: FieldValue.serverTimestamp()
                    });

                    newBatch.set(db.collection("profiles").doc(uid), {
                        nome: nome,
                        email: targetEmail,
                        role: "responsavel",
                        cpf: cleanCPF,
                        updated_at: FieldValue.serverTimestamp()
                    });

                    // Vincular todos os estudantes deste CPF ao novo UID
                    const studentsToLink = await db.collection("estudantes")
                        .where("responsavel_cpf", "in", [cpf, formatToCPF(cpf)])
                        .get();

                    studentsToLink.docs.forEach(doc => {
                        newBatch.update(doc.ref, {
                            usuario_id: uid,
                            updated_at: FieldValue.serverTimestamp()
                        });
                    });

                    await newBatch.commit();
                    accountStatus = "created";
                }
            }
        }

        return { success: true, updatedCount, accountStatus };
    } catch (error: any) {
        console.error(`Erro na sincronização de dados do CPF ${cpf}:`, error);
        throw new HttpsError("internal", `Erro durante o processamento: ${error.message}`);
    }
});
