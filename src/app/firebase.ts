// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBT3vLsTW-qWHUJOtlZ-lM1mcHxC1oDWTU",
  authDomain: "diariodigital-e35c2.firebaseapp.com",
  projectId: "diariodigital-e35c2",
  storageBucket: "diariodigital-e35c2.firebasestorage.app",
  messagingSenderId: "521750766445",
  appId: "1:521750766445:web:ed6cc1eb16c6c9736f7064",
  measurementId: "G-H6GQEPCTXE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
