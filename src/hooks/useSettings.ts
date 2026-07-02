import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Settings } from '../types';
import { db } from '../firebase';
import { defaultSettings } from '../utils/storage';

export function useSettings(uid: string) {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSettings(defaultSettings());
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'users', uid, 'settings', 'data');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...defaultSettings(), ...(snap.data() as Partial<Settings>) });
        } else {
          setSettings(defaultSettings());
        }
        setLoading(false);
      },
      () => {
        setSettings(defaultSettings());
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid]);

  const updateSettings = useCallback(
    async (data: Partial<Settings>) => {
      const updated = { ...settings, ...data };
      await setDoc(doc(db, 'users', uid, 'settings', 'data'), updated);
      setSettings(updated);
      return updated;
    },
    [settings, uid],
  );

  return { settings, loading, updateSettings };
}
