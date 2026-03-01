import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase';

/**
 * Registra uma atividade no log do sistema.
 * A atividade será armazenada na coleção 'activity_log'.
 * @param action A descrição da ação realizada. Ex: "criou o usuário 'John Doe'".
 */
export async function logActivity(action: string) {
  const user = auth.currentUser;

  if (!user) {
    console.warn("Tentativa de log sem usuário autenticado:", action);
    return;
  }

  // Lê o escola_id ativo da sessão (gravado pelo useUserRole)
  const escolaId = sessionStorage.getItem('escolaAtivaId') || '';

  try {
    await addDoc(collection(db, 'activity_log'), {
      user_id: user.uid,
      user_name: user.displayName || user.email,
      action: action,
      escola_id: escolaId,
      created_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao registrar atividade no log:", error);
  }
}