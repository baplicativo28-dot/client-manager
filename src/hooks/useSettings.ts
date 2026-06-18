import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Settings } from '../types';
import { db } from '../firebase';
import { defaultSettings } from '../utils/storage';

export function useSettings(uid: string) {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'settings', 'data');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSettings({ ...defaultSettings(), ...(snap.data() as Partial<Settings>) });
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  const updateSettings = useCallback(
    (data: Partial<Settings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...data };
        void setDoc(doc(db, 'users', uid, 'settings', 'data'), updated);
        return updated;
      });
    },
    [uid],
  );

  return { settings, loading, updateSettings };
}
