import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, createResellerAccount, auth } from '../firebase';
import type { UserProfile } from '../types';

export function useResellers(adminUid: string) {
  const [resellers, setResellers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminUid) return;
    const q = query(
      collection(db, 'users'),
      where('createdBy', '==', adminUid),
      where('role', '==', 'reseller'),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data() as UserProfile);
      setResellers(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [adminUid]);

  const createReseller = useCallback(
    async (email: string, password: string): Promise<void> => {
      const uid = await createResellerAccount(email, password);
      const profile: UserProfile = {
        uid,
        email,
        role: 'reseller',
        blocked: false,
        createdBy: adminUid,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), profile);
    },
    [adminUid],
  );

  const toggleBlock = useCallback(async (uid: string, blocked: boolean): Promise<void> => {
    await updateDoc(doc(db, 'users', uid), { blocked });
  }, []);

  const deleteReseller = useCallback(async (uid: string): Promise<void> => {
    const batch = writeBatch(db);
    // Delete all clients in subcollection
    const clientsSnap = await getDocs(collection(db, 'users', uid, 'clients'));
    clientsSnap.docs.forEach((d) => batch.delete(d.ref));
    // Delete settings doc
    batch.delete(doc(db, 'users', uid, 'settings', 'data'));
    // Delete user profile doc
    batch.delete(doc(db, 'users', uid));
    await batch.commit();
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  return { resellers, loading, createReseller, toggleBlock, deleteReseller, sendPasswordReset };
}
