// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqqQc40zPjlX4K5bN8BlQU32lt4TcLXmQ",
  authDomain: "diariodigital-398c9.firebaseapp.com",
  projectId: "diariodigital",
  storageBucket: "diariodigital.firebasestorage.app",
  messagingSenderId: "632574845450",
  appId: "1:632574845450:web:97293488f521417b3575f3", // Adicionei a vírgula aqui
  measurementId: "G-H6GQEPCTXE"
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;