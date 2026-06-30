'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export function AuthProvider({ children }: AuthProviderProps) {
  // Lazy initializers read sessionStorage once on mount (client-only).
  // Server renders null/false; client hydrates from persisted session.
  const [user, setUser] = useState<AuthResponse['user'] | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('tenant_slug');
  });
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('session_id');
  });
  // Start as loading when a persisted session exists so the UI doesn't flash.
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!(sessionStorage.getItem('user') && sessionStorage.getItem('session_id'));
  });

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

  // On mount: verify persisted session with backend to obtain tenantId.
  // Reads sessionStorage directly so the effect has no React state dependencies.
  useEffect(() => {
    const hasSavedSession =
      sessionStorage.getItem('user') && sessionStorage.getItem('session_id');

    if (!hasSavedSession) {
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
        setUser(null);
        setTenantSlug(null);
        setSessionId(null);
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