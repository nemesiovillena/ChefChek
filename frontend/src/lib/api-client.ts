import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request ID generation
const generateRequestId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Refresh token endpoint
const refreshToken = async () => {
  try {
    const sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      throw new Error('No session ID found');
    }

    const response = await axios.post(`${API_BASE_URL}/v1/auth/refresh`, { sessionId }, {
      withCredentials: true, // Important for httpOnly cookies
    });
    return response.data.data;
  } catch (error) {
    // If refresh fails, redirect to login
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('session_id');
      sessionStorage.removeItem('tenant_slug');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw error;
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Generate request ID for tracing
    const requestId = generateRequestId();
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = requestId;

    // Add Authorization header with session ID if exists in memory
    if (typeof window !== 'undefined') {
      const sessionId = sessionStorage.getItem('session_id');
      if (sessionId && config.headers) {
        config.headers.Authorization = `Bearer ${sessionId}`;
      }
    }

    // Add X-Tenant-Slug header from tenant context
    if (typeof window !== 'undefined') {
      const tenantSlug = sessionStorage.getItem('tenant_slug');
      if (tenantSlug && config.headers) {
        config.headers['X-Tenant-Slug'] = tenantSlug;
      }
    }

    // FormData bodies (file uploads) need the browser to compute the
    // multipart boundary itself. The instance default ('application/json')
    // would otherwise stick and axios would JSON.stringify the FormData
    // into "{}", silently dropping the file.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Extended config type carrying internal retry flags. These fields are not
// part of axios's public types but are used by the interceptor below.
interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Transform backend responses to match frontend expectations
    if (response.data && typeof response.data === 'object') {
      // Handle paginated responses: { success: true, data: [...], meta: {...} }
      // Transform to: { data: [...], total: 5, ... }
      if (response.data.success && response.data.meta) {
        const { data, meta } = response.data;
        return {
          ...response,
          data: {
            data,
            total: meta.total,
            page: meta.page,
            pageSize: meta.limit,
            totalPages: Math.ceil(meta.total / meta.limit),
            hasNext: meta.page < Math.ceil(meta.total / meta.limit),
            hasPrevious: meta.page > 1,
          },
        };
      }
      // Handle single item responses: { success: true, data: {...} }
      // Transform to: { data: {...} }
      if (response.data.success && !response.data.meta) {
        return {
          ...response,
          data: response.data.data,
        };
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshToken();

        // Retry original request with new session ID
        if (typeof window !== 'undefined') {
          const sessionId = sessionStorage.getItem('session_id');
          if (sessionId && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${sessionId}`;
          }
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('session_id');
          sessionStorage.removeItem('tenant_slug');
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('tenant_id');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 5xx errors - retry up to 3 times
    if (error.response?.status && error.response.status >= 500 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const retryCount = originalRequest._retryCount || 0;

      if (retryCount < 3) {
        originalRequest._retryCount = retryCount + 1;
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    // Handle 403 from a disabled module (ModuleGuard): signal the app so it can
    // refresh the navigation and redirect away from the blocked route. The
    // request is still rejected so callers can handle the error as usual.
    if (error.response?.status === 403 && typeof window !== 'undefined') {
      const message = (error.response.data as { message?: string } | undefined)?.message ?? '';
      if (message.startsWith("Module '")) {
        window.dispatchEvent(new CustomEvent('chefchek:module-disabled'));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;