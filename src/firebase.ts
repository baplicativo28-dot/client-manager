import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDx4cPDuG_VjDRglDZx1uJSbIjvRew95m0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'brachip-9dc95.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'brachip-9dc95',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'brachip-9dc95.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '366388600626',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:366388600626:web:3b8a6af17c79c82831012b',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

const isLocalEmulatorMode =
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

if (isLocalEmulatorMode) {
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectAuthEmulator(auth, 'http://127.0.0.1:9098', { disableWarnings: true });
}

/**
 * Cria um novo usuário Firebase Auth usando uma segunda instância do app,
 * sem deslogar o admin logado na instância principal.
 */
export async function createResellerAccount(email: string, password: string): Promise<string> {
  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  if (isLocalEmulatorMode) {
    connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9098', { disableWarnings: true });
  }
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
