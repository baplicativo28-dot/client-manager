import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Client } from '../types';

export type PendingActionType = 'update' | 'renew' | 'observation' | 'deactivate' | 'delete';

export interface PendingAction {
  id: string;
  uid: string;
  clientId: string;
  type: PendingActionType;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
}

const getQueueKey = (uid: string) => `cm_pending_actions_${uid}`;
const listeners = new Set<(online: boolean) => void>();

export function isOnline(): boolean {
  return navigator.onLine;
}

function readQueue(uid: string): PendingAction[] {
  const raw = localStorage.getItem(getQueueKey(uid));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingAction[];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, actions: PendingAction[]): void {
  localStorage.setItem(getQueueKey(uid), JSON.stringify(actions));
}

function emitConnectionChange(): void {
  const online = isOnline();
  listeners.forEach((listener) => listener(online));
}

export function addConnectionListeners(listener: (online: boolean) => void): () => void {
  listeners.add(listener);
  const onOnline = () => {
    emitConnectionChange();
  };
  const onOffline = () => {
    emitConnectionChange();
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function addPendingAction(
  uid: string,
  clientId: string,
  type: PendingActionType,
  payload: Record<string, unknown>,
): void {
  const actions = readQueue(uid);
  actions.push({
    id: crypto.randomUUID(),
    uid,
    clientId,
    type,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  writeQueue(uid, actions);
  emitConnectionChange();
}

export function getPendingActions(uid: string): PendingAction[] {
  return readQueue(uid);
}

export function removePendingAction(uid: string, actionId: string): void {
  const actions = readQueue(uid).filter((action) => action.id !== actionId);
  writeQueue(uid, actions);
}

export function incrementPendingAttempts(uid: string, actionId: string): void {
  const actions = readQueue(uid).map((action) =>
    action.id === actionId ? { ...action, attempts: action.attempts + 1 } : action,
  );
  writeQueue(uid, actions);
}

export function mergeClientWithPendingActions(client: Client, actions: PendingAction[]): Client {
  const clientActions = actions.filter((action) => action.clientId === client.id);
  if (clientActions.some((action) => action.type === 'delete')) {
    return client;
  }

  return clientActions.reduce<Client>((currentClient, action) => {
    if (action.type === 'delete') {
      return currentClient;
    }

    const payload = action.payload || {};
    return {
      ...currentClient,
      ...payload,
      id: currentClient.id,
    };
  }, client);
}

export async function syncOfflineSettings(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'settings', 'data');
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await setDoc(ref, snap.data(), { merge: true });
}