'use client';

import { createContext, useContext, useState, useSyncExternalStore, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface Session {
  id: string;
  expiresAt: string;
  cookie?: string;
}

interface AuthData {
  user: User;
  session: Session;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SSR-safe localStorage getter
const getAuthData = (): AuthData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const sessionData = localStorage.getItem('session');
    if (!sessionData) return null;

    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error parsing auth data:', error);
    return null;
  }
};

// SSR-safe localStorage setter
const setAuthData = (data: AuthData | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (data) {
      localStorage.setItem('session', JSON.stringify(data));
    } else {
      localStorage.removeItem('session');
    }
  } catch (error) {
    console.error('Error setting auth data:', error);
  }
};

// useSyncExternalStore subscribe + snapshots for reading persisted auth data
// without setState-in-effect. The server snapshot returns null; the client
// snapshot reads localStorage once on mount.
const subscribeAuthData = () => () => {};
const getAuthDataSnapshot = () => getAuthData();
const getAuthDataServerSnapshot = (): AuthData | null => null;

export function AuthProvider({ children }: { children: ReactNode }) {
  // On the client this resolves to the persisted data (or null) before the
  // first paint, so there is no flash of unauthenticated state and no effect.
  const persistedAuthData = useSyncExternalStore(
    subscribeAuthData,
    getAuthDataSnapshot,
    getAuthDataServerSnapshot,
  );

  const [user, setUser] = useState<User | null>(persistedAuthData?.user ?? null);
  const [session, setSession] = useState<Session | null>(persistedAuthData?.session ?? null);
  // Loading is always false: auth data is hydrated synchronously from
  // localStorage via useSyncExternalStore, so there is no async init phase.
  const loading = false;

  const login = async (email: string, password: string, tenantId: string) => {
    const response = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, tenantId }),
    });

    const data = await response.json();

    if (data.success) {
      const authData = data.data as AuthData;
      setUser(authData.user);
      setSession(authData.session);
      setAuthData(authData);
    } else {
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    if (session) {
      try {
        await fetch('http://localhost:3001/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.id}`,
          },
          body: JSON.stringify({ sessionId: session.id }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    setUser(null);
    setSession(null);
    setAuthData(null);

    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const isAuthenticated = !loading && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}