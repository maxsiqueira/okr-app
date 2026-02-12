import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDiuiCD56E8BMt_TMXdFZ_WNxmUCMv30Fk",
  authDomain: "gen-lang-client-06714236-467f1.firebaseapp.com",
  projectId: "gen-lang-client-06714236-467f1",
  storageBucket: "gen-lang-client-06714236-467f1.firebasestorage.app",
  messagingSenderId: "240440830582",
  appId: "1:103434020507:web:efeba6bd9cb5a6c8c5c83e"
};

// Inicializa o Firebase e o Firestore
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
