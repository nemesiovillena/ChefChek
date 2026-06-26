'use client';

import React, { createContext, useContext, useState, useEffect, useSyncExternalStore, ReactNode } from 'react';
import authService, { AuthResponse, LoginCredentials, RegisterData } from '@/services/auth.service';
import { getWebSocketClient, resetWebSocketClient } from '@/lib/websocket-client';

export interface AuthContextType {
  user: AuthResponse['user'] | null;
  tenantId: string | null;
  tenantSlug: string | null;
  sessionId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Snapshot of the persisted session data in sessionStorage. Used to hydrate
// the initial state synchronously on the client without setState-in-effect.
interface PersistedSession {
  user: AuthResponse['user'] | null;
  tenantSlug: string | null;
  sessionId: string | null;
}

// Stable empty snapshot reused on the server and as the initial client value.
// useSyncExternalStore requires getSnapshot/getServerSnapshot to return a
// stable reference when the store hasn't changed — returning a fresh object
// literal each call makes React re-render in an infinite loop.
const EMPTY_PERSISTED_SESSION: PersistedSession = {
  user: null,
  tenantSlug: null,
  sessionId: null,
};

// The store never emits (subscribe is a no-op), so the client snapshot only
// matters for initial hydration. Compute it once per page load and reuse it
// to keep the reference stable across renders.
let clientSnapshot: PersistedSession = EMPTY_PERSISTED_SESSION;
let clientSnapshotInitialized = false;

const readPersistedSession = (): PersistedSession => {
  if (typeof window === 'undefined') {
    return EMPTY_PERSISTED_SESSION;
  }
  if (!clientSnapshotInitialized) {
    const savedUser = sessionStorage.getItem('user');
    const savedTenantSlug = sessionStorage.getItem('tenant_slug');
    const savedSessionId = sessionStorage.getItem('session_id');
    let parsedUser: AuthResponse['user'] | null = null;
    if (savedUser) {
      try {
        parsedUser = JSON.parse(savedUser);
      } catch {
        parsedUser = null;
      }
    }
    clientSnapshot = {
      user: parsedUser,
      tenantSlug: savedTenantSlug,
      sessionId: savedSessionId,
    };
    clientSnapshotInitialized = true;
  }
  return clientSnapshot;
};

const subscribePersistedSession = () => () => {};
const getServerPersistedSession = (): PersistedSession => EMPTY_PERSISTED_SESSION;

export function AuthProvider({ children }: AuthProviderProps) {
  // Hydrate from sessionStorage synchronously on the client to avoid the
  // previous setState-in-effect pattern for the instant-load path.
  const persisted = useSyncExternalStore(
    subscribePersistedSession,
    readPersistedSession,
    getServerPersistedSession,
  );

  const [user, setUser] = useState<AuthResponse['user'] | null>(persisted.user);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(persisted.tenantSlug);
  const [sessionId, setSessionId] = useState<string | null>(persisted.sessionId);
  // Only show a loading state when there is a persisted session that needs
  // backend verification. When there is nothing persisted, the initial state
  // is already final, so loading is false and no setState-in-effect is needed.
  // Start in loading state so auth guards wait for the mount-time session
  // validation instead of redirecting during the SSR/hydration window where
  // the persisted snapshot is still empty.
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = !!user;

  // WebSocket connection management
  useEffect(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient({
        user,
        sessionId,
      });

      wsClient.connect().catch((error) => {
        console.error('Failed to connect WebSocket:', error);
      });

      return () => {
        wsClient.disconnect();
      };
    } else {
      resetWebSocketClient();
    }
  }, [isAuthenticated, sessionId, user, tenantId]);

  // Check session on mount. getCurrentSession() returns null when there is no
  // persisted session, so all setState happens inside the resolved promise
  // callback (no synchronous setState-in-effect). isLoading starts true so
  // auth guards wait for this validation instead of redirecting during the
  // SSR/hydration window where the persisted snapshot is still empty.
  useEffect(() => {
    let cancelled = false;
    authService
      .getCurrentSession()
      .then((session) => {
        if (cancelled) return;
        if (session) {
          // Restore the user from the validated session. Without this, a hard
          // reload leaves `user` null (useState initializes during hydration
          // from the empty server snapshot) and protected routes redirect to
          // /login even with a valid persisted session.
          setUser(session.user);
          setTenantId(session.user.tenantId);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error loading saved session:', error);
        sessionStorage.removeItem('session_id');
        sessionStorage.removeItem('tenant_slug');
        sessionStorage.removeItem('user');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.loginWithEmail(credentials);
      setUser(response.user);
      setTenantId(response.user.tenantId);
      setTenantSlug(credentials.tenantSlug);

      // Persist to sessionStorage
      const sessionId = response.session.id;
      setSessionId(sessionId);
      sessionStorage.setItem('session_id', sessionId);
      sessionStorage.setItem('tenant_slug', credentials.tenantSlug);
      sessionStorage.setItem('user', JSON.stringify(response.user));
      sessionStorage.setItem('tenant_id', response.user.tenantId);

      // WebSocket will auto-connect via useEffect
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await authService.register(data);
      setUser(response.user);
      setTenantId(response.user.tenantId);
      setTenantSlug(authService.getCurrentTenantSlug());
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setTenantId(null);
      setTenantSlug(null);
      setSessionId(null);
      // Clear all session data
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tenant_id');

      // Disconnect WebSocket
      resetWebSocketClient();
    } catch (error) {
      console.error('Error during logout:', error);
      // Force logout even if API call fails
      setUser(null);
      setTenantId(null);
      setTenantSlug(null);
      setSessionId(null);
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tenant_id');

      // Disconnect WebSocket
      resetWebSocketClient();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const session = await authService.refreshToken();
      if (session) {
        setUser(session.user);
        setTenantId(session.user.tenantId);
        setTenantSlug(authService.getCurrentTenantSlug());
      } else {
        // Session refresh failed
        setUser(null);
        setTenantId(null);
        setTenantSlug(null);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      setUser(null);
      setTenantId(null);
      setTenantSlug(null);
    }
  };

  const value: AuthContextType = {
    user,
    tenantId,
    tenantSlug,
    sessionId,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}