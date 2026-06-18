import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isBlocked: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await signOut(auth);
    localStorage.removeItem('cm_last_activity');
  }, []);

  // Session timeout: auto-logout after 3 hours of inactivity
  useEffect(() => {
    const resetTimer = () => {
      localStorage.setItem('cm_last_activity', Date.now().toString());
    };

    // Check on mount if session has expired
    const lastActivity = localStorage.getItem('cm_last_activity');
    if (lastActivity && Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS) {
      void signOut(auth);
      localStorage.removeItem('cm_last_activity');
      return;
    }

    resetTimer();

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Check periodically
    const interval = setInterval(() => {
      const last = localStorage.getItem('cm_last_activity');
      if (last && Date.now() - parseInt(last, 10) > SESSION_TIMEOUT_MS) {
        void logout();
      }
    }, 60 * 1000); // check every minute

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearInterval(interval);
    };
  }, [logout]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          // Primeiro login: cria perfil de admin
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            role: 'admin',
            blocked: false,
            createdBy: null,
            createdAt: new Date().toISOString(),
          };
          await setDoc(ref, profile);
          setUserProfile(profile);
        }
        localStorage.setItem('cm_last_activity', Date.now().toString());
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem('cm_last_activity', Date.now().toString());
  };

  const isAdmin = userProfile?.role === 'admin';
  const isBlocked = userProfile?.blocked === true;

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin, isBlocked, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
