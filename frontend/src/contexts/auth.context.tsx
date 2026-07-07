'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService, { AuthResponse, LoginCredentials, RegisterData } from '@/services/auth.service';
import { getWebSocketClient, resetWebSocketClient } from '@/lib/websocket-client';
import { slugify } from '@/lib/utils';

export interface AuthContextType {
  user: AuthResponse['user'] | null;
  tenantId: string | null;
  tenantSlug: string | null;
  sessionId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginSuperadmin: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Re-valida la sesión contra el backend y refresca `user` (p. ej. tras editar el propio perfil). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Server and first client render share the same empty state to avoid
  // hydration mismatches; the persisted session is restored after mount.
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Start loading so protected routes don't redirect to /login before the
  // persisted session is restored on mount.
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

  // On mount: verify the persisted session with the backend. Loading stays
  // true until validation resolves, so protected routes don't flash a login
  // redirect. Runs only on the client after hydration, so the server/client
  // first render stay identical (both see the empty initial state). All
  // setState calls live in async callbacks.
  useEffect(() => {
    let cancelled = false;

    const clearSession = () => {
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      setUser(null);
      setTenantSlug(null);
      setSessionId(null);
      setTenantId(null);
      setIsLoading(false);
    };

    authService
      .getCurrentSession()
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          clearSession();
          return;
        }
        setUser(session.user);
        setTenantId(session.user.tenantId);
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error loading saved session:', error);
        clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.loginWithEmail(credentials);
      // Mismo saneado que auth.service: el slug acaba en headers HTTP, que
      // solo aceptan ISO-8859-1 (texto pegado puede traer acentos NFD).
      const safeTenantSlug = slugify(credentials.tenantSlug);
      setUser(response.user);
      setTenantId(response.user.tenantId);
      setTenantSlug(safeTenantSlug);

      // Persist to sessionStorage
      const sessionId = response.session.id;
      setSessionId(sessionId);
      sessionStorage.setItem('session_id', sessionId);
      sessionStorage.setItem('tenant_slug', safeTenantSlug);
      sessionStorage.setItem('user', JSON.stringify(response.user));
      if (response.user.tenantId) {
        sessionStorage.setItem('tenant_id', response.user.tenantId);
      }

      // WebSocket will auto-connect via useEffect
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginSuperadmin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.loginSuperadmin(email, password);
      setUser(response.user);
      setTenantId(null);
      setTenantSlug(null);

      const sessionId = response.session.id;
      setSessionId(sessionId);
      sessionStorage.setItem('session_id', sessionId);
      sessionStorage.setItem('user', JSON.stringify(response.user));
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

  const refreshUser = async () => {
    const session = await authService.getCurrentSession();
    if (session) {
      setUser(session.user);
      sessionStorage.setItem('user', JSON.stringify(session.user));
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
    loginSuperadmin,
    register,
    logout,
    refreshSession,
    refreshUser,
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