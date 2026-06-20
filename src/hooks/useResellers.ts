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
    const CHUNK = 400;

    // Delete all clients
    const clientsSnap = await getDocs(collection(db, 'users', uid, 'clients'));
    for (let i = 0; i < clientsSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      clientsSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Delete finance entries
    const entriesSnap = await getDocs(collection(db, 'users', uid, 'financeEntries'));
    for (let i = 0; i < entriesSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      entriesSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Delete finance products
    const productsSnap = await getDocs(collection(db, 'users', uid, 'financeProducts'));
    for (let i = 0; i < productsSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      productsSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Delete settings doc
    const settingsSnap = await getDocs(collection(db, 'users', uid, 'settings'));
    if (!settingsSnap.empty) {
      const batch = writeBatch(db);
      settingsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Keep the user profile document but mark as blocked so they can't log in
    await import('firebase/firestore').then(({ updateDoc, doc: firestoreDoc }) =>
      updateDoc(firestoreDoc(db, 'users', uid), { blocked: true, deletedAt: new Date().toISOString() }),
    );
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  return { resellers, loading, createReseller, toggleBlock, deleteReseller, sendPasswordReset };
}
