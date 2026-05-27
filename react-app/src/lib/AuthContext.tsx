import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { clearUser, getUser, setUser as persistUser } from './auth';

interface AuthState {
  user: User | null;
  signIn: (email: string, name?: string) => User;
  signUp: (email: string, name?: string) => User;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => getUser());

  // Stay in sync with other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'cv_user') setUserState(getUser());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    signIn(email, name) {
      const u: User = { email, name, createdAt: Date.now() };
      persistUser(u);
      setUserState(u);
      return u;
    },
    signUp(email, name) {
      const u: User = { email, name, createdAt: Date.now() };
      persistUser(u);
      setUserState(u);
      return u;
    },
    signOut() {
      clearUser();
      setUserState(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
