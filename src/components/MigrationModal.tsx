import { useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Client, Settings } from '../types';
import { defaultSettings } from '../utils/storage';

interface MigrationModalProps {
  uid: string;
  onDone: () => void;
}

export function MigrationModal({ uid, onDone }: MigrationModalProps) {
  const [loading, setLoading] = useState(false);

  const getLocalClients = (): Client[] => {
    try {
      const raw = localStorage.getItem('cm_clients');
      if (!raw) return [];
      return JSON.parse(raw) as Client[];
    } catch {
      return [];
    }
  };

  const getLocalSettings = (): Settings | null => {
    try {
      const raw = localStorage.getItem('cm_settings');
      if (!raw) return null;
      return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const clients = getLocalClients();
      const settings = getLocalSettings();

      // Write clients in batches (Firestore limit: 500 per batch)
      const batchSize = 400;
      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = clients.slice(i, i + batchSize);
        chunk.forEach((client) => {
          const ref = doc(db, 'users', uid, 'clients', client.id);
          batch.set(ref, client);
        });
        await batch.commit();
      }

      // Write settings
      if (settings) {
        await setDoc(doc(db, 'users', uid, 'settings', 'data'), settings);
      }

      // Clear localStorage
      localStorage.removeItem('cm_clients');
      localStorage.removeItem('cm_settings');
      localStorage.removeItem('cm_logged_in');

      onDone();
    } catch (err) {
      console.error('Migration failed:', err);
      alert('Erro ao importar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Clear legacy localStorage keys and start fresh
    localStorage.removeItem('cm_clients');
    localStorage.removeItem('cm_settings');
    localStorage.removeItem('cm_logged_in');
    onDone();
  };

  const localCount = getLocalClients().length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-md border border-border">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-2">Dados locais encontrados</h2>
          <p className="text-sm text-gray-500 mb-4">
            Encontramos <strong>{localCount} clientes</strong> salvos localmente neste navegador.
            Deseja importá-los para a sua conta na nuvem?
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void handleImport()}
              disabled={loading}
              className="w-full bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {loading ? 'Importando...' : `Importar ${localCount} clientes para a nuvem`}
            </button>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="w-full border border-border rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Começar do zero (ignorar dados locais)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
