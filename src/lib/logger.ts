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

  const escolaId = sessionStorage.getItem('escolaAtivaId') || '';

  // Lê o role ativo da sessão para permitir filtragem de logs de admin
  let userRole = '';
  try {
    const profileJson = sessionStorage.getItem('activeProfile');
    if (profileJson) {
      userRole = JSON.parse(profileJson).role || '';
    }
  } catch (_) { /* ignore */ }

  try {
    await addDoc(collection(db, 'activity_log'), {
      usuario_id: user.uid,
      user_name: user.displayName || user.email,
      action: action,
      escola_id: escolaId,
      role: userRole,
      source: 'diariodigital',
      created_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Sem permissão para registrar atividade no log:", error);
  }
}