import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Client, Settings } from '../types';
import { defaultSettings, generateId } from './storage';
import {
  addPendingAction,
  getPendingActions,
  incrementPendingAttempts,
  isOnline,
  removePendingAction,
  type PendingAction,
  type PendingActionType,
} from './offlineQueue';

// ─── Clients ─────────────────────────────────────────────────────────────────

function clientsRef(uid: string) {
  return collection(db, 'users', uid, 'clients');
}

function clientDocRef(uid: string, clientId: string) {
  return doc(db, 'users', uid, 'clients', clientId);
}

export async function getClientsFromFirestore(uid: string): Promise<Client[]> {
  const snap = await getDocs(clientsRef(uid));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Client));
}

export async function addClientToFirestore(uid: string, client: Client): Promise<void> {
  const id = client.id || generateId();
  await setDoc(clientDocRef(uid, id), { ...client, id });
}

export async function updateClientInFirestore(
  uid: string,
  id: string,
  data: Partial<Client>
): Promise<void> {
  await updateDoc(clientDocRef(uid, id), data as Record<string, unknown>);
}

export async function deleteClientFromFirestore(uid: string, id: string): Promise<void> {
  await deleteDoc(clientDocRef(uid, id));
}

export async function saveAllClientsToFirestore(uid: string, clients: Client[]): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < clients.length; i += CHUNK) {
    const batch = writeBatch(db);
    clients.slice(i, i + CHUNK).forEach((client) => {
      const ref = clientDocRef(uid, client.id);
      batch.set(ref, client);
    });
    await batch.commit();
  }
}

// ─── Offline-aware operations ────────────────────────────────────────────────

function isFirestoreError(error: unknown): boolean {
  return error instanceof Error &&
    (error.message.includes('offline') ||
      error.message.includes('unavailable') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('connection'));
}

export async function updateClientWithOffline(
  uid: string,
  id: string,
  data: Partial<Client>
): Promise<void> {
  if (!isOnline()) {
    addPendingAction(uid, id, 'update', data);
    return;
  }
  try {
    await updateClientInFirestore(uid, id, data);
  } catch (error) {
    if (isFirestoreError(error)) {
      addPendingAction(uid, id, 'update', data);
      return;
    }
    throw error;
  }
}

export async function renewClientWithOffline(
  uid: string,
  id: string,
  data: Partial<Client>
): Promise<void> {
  if (!isOnline()) {
    addPendingAction(uid, id, 'renew', data);
    return;
  }
  try {
    await updateClientInFirestore(uid, id, data);
  } catch (error) {
    if (isFirestoreError(error)) {
      addPendingAction(uid, id, 'renew', data);
      return;
    }
    throw error;
  }
}

export async function addObservationWithOffline(
  uid: string,
  id: string,
  observacao: string
): Promise<void> {
  if (!isOnline()) {
    addPendingAction(uid, id, 'observation', { observacao });
    return;
  }
  try {
    await updateClientInFirestore(uid, id, { observacao });
  } catch (error) {
    if (isFirestoreError(error)) {
      addPendingAction(uid, id, 'observation', { observacao });
      return;
    }
    throw error;
  }
}

export async function deactivateClientWithOffline(
  uid: string,
  id: string,
  data: Partial<Client>
): Promise<void> {
  if (!isOnline()) {
    addPendingAction(uid, id, 'deactivate', data);
    return;
  }
  try {
    await updateClientInFirestore(uid, id, data);
  } catch (error) {
    if (isFirestoreError(error)) {
      addPendingAction(uid, id, 'deactivate', data);
      return;
    }
    throw error;
  }
}

export async function deleteClientWithOffline(uid: string, id: string): Promise<void> {
  if (!isOnline()) {
    addPendingAction(uid, id, 'delete', {});
    return;
  }
  try {
    await deleteClientFromFirestore(uid, id);
  } catch (error) {
    if (isFirestoreError(error)) {
      addPendingAction(uid, id, 'delete', {});
      return;
    }
    throw error;
  }
}

// ─── Sync queue ──────────────────────────────────────────────────────────────

const actionHandlers: Record<
  PendingActionType,
  (uid: string, clientId: string, payload: PendingAction['payload']) => Promise<void>
> = {
  update: (uid, clientId, payload) => updateClientInFirestore(uid, clientId, payload as Partial<Client>),
  renew: (uid, clientId, payload) => updateClientInFirestore(uid, clientId, payload as Partial<Client>),
  observation: (uid, clientId, payload) =>
    updateClientInFirestore(uid, clientId, payload as Partial<Client>),
  deactivate: (uid, clientId, payload) => updateClientInFirestore(uid, clientId, payload as Partial<Client>),
  delete: (uid, clientId) => deleteClientFromFirestore(uid, clientId),
};

export async function syncPendingActions(
  uid: string,
  options?: { onProgress?: (action: PendingAction, success: boolean) => void }
): Promise<{ success: number; failed: number }> {
  const actions = getPendingActions(uid);
  let success = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const handler = actionHandlers[action.type];
      await handler(action.uid, action.clientId, action.payload);
      removePendingAction(uid, action.id);
      success += 1;
      options?.onProgress?.(action, true);
    } catch {
      incrementPendingAttempts(uid, action.id);
      failed += 1;
      options?.onProgress?.(action, false);
    }
  }

  return { success, failed };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function settingsDocRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'data');
}

export async function getSettingsFromFirestore(uid: string): Promise<Settings> {
  const snap = await getDoc(settingsDocRef(uid));
  if (snap.exists()) {
    return { ...defaultSettings(), ...(snap.data() as Partial<Settings>) };
  }
  return defaultSettings();
}

export async function saveSettingsToFirestore(uid: string, settings: Settings): Promise<void> {
  await setDoc(settingsDocRef(uid), settings);
}

// ─── Migration check ──────────────────────────────────────────────────────────

export async function deleteAllClientsFromFirestore(uid: string): Promise<number> {
  const snap = await getDocs(clientsRef(uid));
  if (snap.empty) return 0;
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
}

import { calcularStatus } from './helpers';

export async function getExpiredClientsFromFirestore(
  uid: string,
  cutoffDate: string
): Promise<Client[]> {
  const snap = await getDocs(clientsRef(uid));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id } as Client))
    .filter((c) => {
      const isInactive = c.desativado === true;
      const isExpired = calcularStatus(c.dataVencimento) === 'Expirado';

      return c.dataVencimento < cutoffDate && (isInactive || isExpired);
    });
}

export async function deleteClientsFromFirestore(uid: string, clientIds: string[]): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const batch = writeBatch(db);
    clientIds.slice(i, i + CHUNK).forEach((id) => batch.delete(clientDocRef(uid, id)));
    await batch.commit();
  }
}
