import { AxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import { slugify } from '@/lib/utils';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface RegisterData {
  tenantName: string;
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
  };
  session: {
    id: string;
    expiresAt: string;
  };
  cookie: string;
}

export interface ErrorResponse {
  message: string;
  statusCode: number;
  error?: string;
}

class AuthService {
  async loginWithEmail(credentials: LoginCredentials): Promise<AuthResponse> {
    // El slug viaja como header HTTP: solo admite ISO-8859-1. Texto pegado en
    // macOS puede llegar en forma NFD (acentos combinantes > U+00FF) y haría
    // que fetch/XHR lancen "String contains non ISO-8859-1 code point".
    const tenantSlug = slugify(credentials.tenantSlug);
    try {
      // Store tenant slug temporarily for the request
      sessionStorage.setItem('tenant_slug', tenantSlug);

      // Send only email and password, tenantSlug goes via header
      const { email, password } = credentials;
      const response = await apiClient.post<AuthResponse>('/v1/auth/login', { email, password });

      // Store session ID in sessionStorage (memory only, cleared on tab close)
      sessionStorage.setItem('session_id', response.data.session.id);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.user.tenantId) {
        sessionStorage.setItem('tenant_id', response.data.user.tenantId);
      }

      return response.data;
    } catch (error: unknown) {
      // No dejar un slug de un login fallido en sessionStorage: rompería las
      // peticiones posteriores del tab (headers) aunque el usuario reintente.
      sessionStorage.removeItem('tenant_slug');
      const errorResponse = error instanceof AxiosError
        ? (error.response?.data as ErrorResponse | undefined)
        : undefined;
      throw new Error(errorResponse?.message || 'Error al iniciar sesión');
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/v1/auth/register', data);

      // Store session ID and tenant slug
      const tenantSlug = slugify(data.tenantName);
      sessionStorage.setItem('session_id', response.data.session.id);
      sessionStorage.setItem('tenant_slug', tenantSlug);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.user.tenantId) {
        sessionStorage.setItem('tenant_id', response.data.user.tenantId);
      }

      return response.data;
    } catch (error: unknown) {
      const errorResponse = error instanceof AxiosError
        ? (error.response?.data as ErrorResponse | undefined)
        : undefined;
      throw new Error(errorResponse?.message || 'Error al registrarse');
    }
  }

  async logout(): Promise<void> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (sessionId) {
        await apiClient.post('/v1/auth/logout', { sessionId });
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Error during logout:', error);
    } finally {
      // Clear session data
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tenant_id');
    }
  }

  async loginSuperadmin(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/v1/auth/superadmin/login', { email, password });

      sessionStorage.setItem('session_id', response.data.session.id);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      // No tenant_slug for SUPERADMIN

      return response.data;
    } catch (error: unknown) {
      const errorResponse = error instanceof AxiosError
        ? (error.response?.data as ErrorResponse | undefined)
        : undefined;
      throw new Error(errorResponse?.message || 'Error al iniciar sesión como SUPERADMIN');
    }
  }

  async getCurrentSession(): Promise<AuthResponse | null> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      const tenantSlug = sessionStorage.getItem('tenant_slug');
      const savedUser = sessionStorage.getItem('user');

      const userObj = savedUser ? JSON.parse(savedUser) : null;
      const isSuperadmin = userObj?.role === 'SUPERADMIN';

      if (!sessionId || (!tenantSlug && !isSuperadmin) || !savedUser) return null;

      // Validate session with backend
      const response = await apiClient.get<{ user: AuthResponse['user']; isValid: boolean }>('/v1/auth/validate');

      if (response.data.isValid && response.data.user) {
        // Reconstruct AuthResponse from saved data + validated user
        return {
          user: response.data.user,
          session: {
            id: sessionId,
            expiresAt: new Date(Date.now() + 86400000).toISOString()
          },
          cookie: ''
        };
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  async refreshToken(): Promise<AuthResponse | null> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      const savedUser = sessionStorage.getItem('user');

      if (!sessionId || !savedUser) return null;

      const response = await apiClient.post<{ id: string; expiresAt: string; cookie: string }>('/v1/auth/refresh', { sessionId });

      // Update session ID in storage
      if (response.data.id) {
        sessionStorage.setItem('session_id', response.data.id);
      }

      // Reconstruct AuthResponse from saved user
      return {
        user: JSON.parse(savedUser),
        session: {
          id: response.data.id,
          expiresAt: response.data.expiresAt
        },
        cookie: response.data.cookie
      };
    } catch (_error) {
      // Refresh failed - session is invalid
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tenant_id');
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem('session_id');
  }

  getCurrentToken(): string | null {
    return sessionStorage.getItem('session_id');
  }

  getCurrentTenantSlug(): string | null {
    return sessionStorage.getItem('tenant_slug');
  }
}

const authService = new AuthService();
export default authService;