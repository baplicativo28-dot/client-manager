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
