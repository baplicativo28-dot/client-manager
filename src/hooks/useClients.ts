import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Client } from '../types';
import { db } from '../firebase';
import { generateId } from '../utils/storage';
import {
  addConnectionListeners,
  getPendingActions,
  isOnline,
  mergeClientWithPendingActions,
} from '../utils/offlineQueue';
import {
  updateClientWithOffline,
  renewClientWithOffline,
  addObservationWithOffline,
  deactivateClientWithOffline,
  deleteClientWithOffline,
  syncPendingActions,
} from '../utils/firestoreUtils';

export function useClients(uid: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(() => {
    if (!uid) {
      setPendingCount(0);
      return;
    }
    setPendingCount(getPendingActions(uid).length);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = addConnectionListeners((nextOnline) => {
      setOnline(nextOnline);
      if (nextOnline) {
        refreshPendingCount();
      }
    });
    setOnline(isOnline());
    refreshPendingCount();
    return unsubscribe;
  }, [uid, refreshPendingCount]);

  useEffect(() => {
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'clients');
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Client));
      const merged = data.map((client) =>
        mergeClientWithPendingActions(client, getPendingActions(uid))
      );
      setClients(merged);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    refreshPendingCount();
  }, [clients, refreshPendingCount]);

  const syncNow = useCallback(async () => {
    if (!uid || !isOnline()) return { success: 0, failed: 0 };
    setSyncing(true);
    try {
      const result = await syncPendingActions(uid);
      refreshPendingCount();
      return result;
    } finally {
      setSyncing(false);
    }
  }, [uid, refreshPendingCount]);

  useEffect(() => {
    if (!uid || !online) return;
    const timer = setTimeout(() => {
      void syncNow();
    }, 1000);
    return () => clearTimeout(timer);
  }, [uid, online, syncNow]);

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
      await updateClientWithOffline(uid, id, sanitized);
      refreshPendingCount();
    },
    [uid, refreshPendingCount],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      await deleteClientWithOffline(uid, id);
      refreshPendingCount();
    },
    [uid, refreshPendingCount],
  );

  const renewClient = useCallback(
    async (id: string, data: Partial<Client>) => {
      await renewClientWithOffline(uid, id, data);
      refreshPendingCount();
    },
    [uid, refreshPendingCount],
  );

  const addObservation = useCallback(
    async (id: string, observacao: string) => {
      await addObservationWithOffline(uid, id, observacao);
      refreshPendingCount();
    },
    [uid, refreshPendingCount],
  );

  const deactivateClient = useCallback(
    async (id: string, data: Partial<Client>) => {
      await deactivateClientWithOffline(uid, id, data);
      refreshPendingCount();
    },
    [uid, refreshPendingCount],
  );

  return {
    clients,
    loading,
    online,
    pendingCount,
    syncing,
    syncNow,
    addClient,
    updateClient,
    deleteClient,
    renewClient,
    addObservation,
    deactivateClient,
  };
}
