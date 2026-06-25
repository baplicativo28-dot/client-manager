import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Client } from '../types';
import { db } from '../firebase';
import { generateId } from '../utils/storage';

export function useClients(uid: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'clients');
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Client));
      setClients(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  const addClient = useCallback(
    async (client: Omit<Client, 'id' | 'desativado' | 'lembreteEnviado' | 'situacao'>) => {
      const id = generateId();
      const newClient: Client = {
        ...client,
        situacao: 'Assinou',
        id,
        desativado: false,
        lembreteEnviado: false,
        criadoEm: client.criadoEm || new Date().toISOString(),
        ultimaRenovacao: null,
        mesesRenovados: 1,
        trustRenewal: false,
        trustPaymentDate: null,
        trustActivationDate: null,
        trustOriginalDueDate: null,
        lastReminderResetDate: null,
      };
      await setDoc(doc(db, 'users', uid, 'clients', id), newClient);
    },
    [uid],
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<Client>) => {
      const sanitized = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ) as Record<string, unknown>;
      await updateDoc(doc(db, 'users', uid, 'clients', id), sanitized);
    },
    [uid],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'users', uid, 'clients', id));
    },
    [uid],
  );

  return { clients, loading, addClient, updateClient, deleteClient };
}
