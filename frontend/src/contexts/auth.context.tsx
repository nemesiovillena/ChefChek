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

const readPersistedSession = (): PersistedSession => {
  if (typeof window === 'undefined') {
    return { user: null, tenantSlug: null, sessionId: null };
  }
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
  return {
    user: parsedUser,
    tenantSlug: savedTenantSlug,
    sessionId: savedSessionId,
  };
};

const subscribePersistedSession = () => () => {};
const getServerPersistedSession = (): PersistedSession => ({
  user: null,
  tenantSlug: null,
  sessionId: null,
});

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
  const [isLoading, setIsLoading] = useState<boolean>(!!persisted.user && !!persisted.sessionId);

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

  // Check session on mount. The backend verification is an external-system
  // subscription: setState calls happen inside the resolved promise callback
  // (after await), not synchronously in the effect body.
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const savedSessionId = sessionStorage.getItem('session_id');

    if (!savedUser || !savedSessionId) {
      return;
    }

    let cancelled = false;
    authService
      .getCurrentSession()
      .then((session) => {
        if (cancelled) return;
        if (session) {
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