import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { FinanceEntry, FinanceProduct } from '../types';
import { db } from '../firebase';
import { generateId } from '../utils/storage';

export function useFinance(uid: string) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [products, setProducts] = useState<FinanceProduct[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      setProducts([]);
      setEntriesLoading(false);
      setProductsLoading(false);
      return;
    }

    setEntriesLoading(true);
    setProductsLoading(true);

    const entriesRef = collection(db, 'users', uid, 'financeEntries');
    const productsRef = collection(db, 'users', uid, 'financeProducts');

    const unsubscribeEntries = onSnapshot(entriesRef, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as FinanceEntry));
      setEntries(data);
      setEntriesLoading(false);
    }, () => {
      setEntries([]);
      setEntriesLoading(false);
    });

    const unsubscribeProducts = onSnapshot(productsRef, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as FinanceProduct));
      setProducts(data);
      setProductsLoading(false);
    }, () => {
      setProducts([]);
      setProductsLoading(false);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeProducts();
    };
  }, [uid]);

  const addEntry = useCallback((entry: Omit<FinanceEntry, 'id' | 'criadoEm'>) => {
    const id = generateId();
    const newEntry: FinanceEntry = {
      ...entry,
      id,
      criadoEm: new Date().toISOString(),
    };
    void setDoc(doc(db, 'users', uid, 'financeEntries', id), newEntry);
  }, [uid]);

  const updateEntry = useCallback((id: string, data: Partial<FinanceEntry>) => {
    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Record<string, unknown>;
    void updateDoc(doc(db, 'users', uid, 'financeEntries', id), sanitized);
  }, [uid]);

  const deleteEntry = useCallback((id: string) => {
    void deleteDoc(doc(db, 'users', uid, 'financeEntries', id));
  }, [uid]);

  const addProduct = useCallback((product: Omit<FinanceProduct, 'id' | 'criadoEm'>) => {
    const id = generateId();
    const newProduct: FinanceProduct = {
      ...product,
      id,
      criadoEm: new Date().toISOString(),
    };
    void setDoc(doc(db, 'users', uid, 'financeProducts', id), newProduct);
  }, [uid]);

  const updateProduct = useCallback((id: string, data: Partial<FinanceProduct>) => {
    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Record<string, unknown>;
    void updateDoc(doc(db, 'users', uid, 'financeProducts', id), sanitized);
  }, [uid]);

  const deleteProduct = useCallback((id: string) => {
    void deleteDoc(doc(db, 'users', uid, 'financeProducts', id));
  }, [uid]);

  return {
    entries,
    products,
    loading: entriesLoading || productsLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    addProduct,
    updateProduct,
    deleteProduct,
  };
}