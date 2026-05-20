import { db, functions, storage } from "@/lib/firebase";
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, QueryConstraint, DocumentData, WithFieldValue, PartialWithFieldValue, 
  addDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { sanitizeInput } from "@/lib/sanitizer";

/**
 * FirebaseFacade
 * Centralizes all external API/Firebase calls per Rule 11.
 * Ensures that all data sent to Firestore or Cloud Functions is sanitized per Rule 8.
 */
export class FirebaseFacade {
  
  // --- FIRESTORE METHODS ---

  /**
   * Creates a document with an auto-generated ID.
   */
  static async addDocument<T extends DocumentData>(collectionName: string, data: WithFieldValue<T>) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.escola_id && !dataObj.escola_ids) {
      dataObj.escola_ids = [dataObj.escola_id];
    }
    const sanitizedData = sanitizeInput(dataObj) as WithFieldValue<T>;
    const collRef = collection(db, collectionName);
    const docRef = await addDoc(collRef, sanitizedData);
    return docRef.id;
  }

  /**
   * Creates or overwrites a document with a specific ID.
   * Pass merge=true to merge instead of overwrite (safe for partial updates on possibly non-existent docs).
   */
  static async setDocument<T extends DocumentData>(collectionName: string, docId: string, data: WithFieldValue<T>, merge = false) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.escola_id && !dataObj.escola_ids) {
      dataObj.escola_ids = [dataObj.escola_id];
    }
    const sanitizedData = sanitizeInput(dataObj) as WithFieldValue<T>;
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, sanitizedData, { merge });
  }

  /**
   * Updates an existing document.
   */
  static async updateDocument<T extends DocumentData>(collectionName: string, docId: string, data: PartialWithFieldValue<T>) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.escola_id && !dataObj.escola_ids) {
      dataObj.escola_ids = [dataObj.escola_id];
    }
    const sanitizedData = sanitizeInput(dataObj) as PartialWithFieldValue<T>;
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, sanitizedData);
  }

  /**
   * Gets a single document by ID.
   */
  static async getDocument<T = DocumentData>(collectionName: string, docId: string): Promise<(T & { id: string }) | null> {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T & { id: string };
    }
    return null;
  }

  /**
   * Queries documents with provided constraints.
   */
  static async queryDocuments<T = DocumentData>(collectionName: string, constraints: QueryConstraint[]): Promise<(T & { id: string })[]> {
    const queryRef = query(collection(db, collectionName), ...constraints);
    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T & { id: string });
  }

  /**
   * Deletes a document.
   */
  static async deleteDocument(collectionName: string, docId: string) {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  }

  /**
   * Performs soft delete on an entity with complete logging and cascades for linked users.
   */
  static async softDeleteEntity(
    collectionName: string, 
    docId: string, 
    entityName: string, 
    operatorName: string
  ): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    
    // 1. Log logical delete to the general 'logs' collection
    await addDoc(collection(db, 'logs'), {
      acao: 'exclusao_logica',
      entidade: collectionName,
      entidade_id: docId,
      usuario: operatorName,
      data: new Date()
    });

    // 2. Mark target document as excluded
    await updateDoc(docRef, {
      excluido: true,
      excluido_em: new Date(),
      excluido_por: operatorName
    });

    // 3. For login-linked collections, disable credentials/profiles
    const loginLinkedCollections = ['professores', 'equipe_gestora', 'responsaveis'];
    if (loginLinkedCollections.includes(collectionName)) {
      try {
        const userRoleRef = doc(db, 'user_roles', docId);
        const roleSnap = await getDoc(userRoleRef);
        if (roleSnap.exists()) {
          await updateDoc(userRoleRef, { 
            status: 'inativo', 
            excluido: true, 
            excluido_em: new Date(), 
            excluido_por: operatorName 
          });
        }
      } catch (err) {
        console.warn('Aviso: user_roles doc não pôde ser desativado:', err);
      }

      try {
        const profileRef = doc(db, 'profiles', docId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          await updateDoc(profileRef, { 
            excluido: true, 
            excluido_em: new Date(), 
            excluido_por: operatorName 
          });
        }
      } catch (err) {
        console.warn('Aviso: profiles doc não pôde ser desativado:', err);
      }
    }

    // 4. Log in active session history
    const { logActivity } = await import("@/lib/logger");
    await logActivity(`excluiu logicamente o registro de ${entityName} na coleção ${collectionName}.`);
  }

  /**
   * Reactivates an entity that was soft-deleted.
   */
  static async reactivateEntity(
    collectionName: string, 
    docId: string, 
    entityName: string
  ): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    
    await updateDoc(docRef, {
      excluido: false,
      reativado_em: new Date()
    });

    const loginLinkedCollections = ['professores', 'equipe_gestora', 'responsaveis'];
    if (loginLinkedCollections.includes(collectionName)) {
      try {
        const userRoleRef = doc(db, 'user_roles', docId);
        const roleSnap = await getDoc(userRoleRef);
        if (roleSnap.exists()) {
          await updateDoc(userRoleRef, { 
            status: 'ativo', 
            excluido: false,
            reativado_em: new Date()
          });
        }
      } catch (err) {
        console.warn('Aviso: user_roles não pôde ser reativado:', err);
      }

      try {
        const profileRef = doc(db, 'profiles', docId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          await updateDoc(profileRef, { 
            excluido: false,
            reativado_em: new Date()
          });
        }
      } catch (err) {
        console.warn('Aviso: profiles não pôde ser reativado:', err);
      }
    }

    const { logActivity } = await import("@/lib/logger");
    await logActivity(`reativou o registro de ${entityName} na coleção ${collectionName}.`);
  }

  // --- CLOUD FUNCTIONS METHODS ---

  /**
   * Calls a Cloud Function after sanitizing the input payload.
   */
  static async callFunction<Req, Res>(functionName: string, data: Req): Promise<Res> {
    const sanitizedData = sanitizeInput(data) as Req;
    const callable = httpsCallable<Req, Res>(functions, functionName);
    const result = await callable(sanitizedData);
    return result.data;
  }

  // --- STORAGE METHODS ---
  // Note: Binary files are not sanitized here, but metadata checks should happen.

  static async uploadFile(path: string, file: File): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  static async deleteFile(path: string): Promise<void> {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  }
}
