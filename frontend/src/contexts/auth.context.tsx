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
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // WebSocket connection management
  useEffect(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient({
        user,
        tenantId,
        sessionId,
      } as any);

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

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    // First, try to load user from sessionStorage for instant load
    const savedUser = sessionStorage.getItem('user');
    const savedTenantSlug = sessionStorage.getItem('tenant_slug');
    const savedSessionId = sessionStorage.getItem('session_id');

    if (savedUser && savedSessionId) {
      try {
        setUser(JSON.parse(savedUser));
        setTenantSlug(savedTenantSlug);
        // Verify session with backend
        const session = await authService.getCurrentSession();
        if (session) {
          setTenantId(session.user.tenantId);
        }
      } catch (error) {
        console.error('Error loading saved session:', error);
        // Clear invalid session
        sessionStorage.removeItem('session_id');
        sessionStorage.removeItem('tenant_slug');
        sessionStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  };

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