import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDx4cPDuG_VjDRglDZx1uJSbIjvRew95m0',
  authDomain: 'brachip-9dc95.firebaseapp.com',
  projectId: 'brachip-9dc95',
  storageBucket: 'brachip-9dc95.firebasestorage.app',
  messagingSenderId: '366388600626',
  appId: '1:366388600626:web:3b8a6af17c79c82831012b',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Cria um novo usuário Firebase Auth usando uma segunda instância do app,
 * sem deslogar o admin logado na instância principal.
 */
export async function createResellerAccount(email: string, password: string): Promise<string> {
  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
