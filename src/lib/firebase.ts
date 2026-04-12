import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Suas credenciais do Firebase usando as variáveis de ambiente do seu .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Corrigido aqui
};

// Inicializa o Firebase (apenas uma vez)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Inicializa e exporta os serviços conforme a arquitetura do projeto
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({})
}, 'database');
export const storage = getStorage(app);
export const functions = getFunctions(app);
export { analytics };

export default app;