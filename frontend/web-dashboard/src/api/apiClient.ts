// src/api/apiClient.ts

import { API_BASE_URL } from '../constants/config';
import { STORAGE_KEYS } from '../constants/storage';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
}

function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

// ─────────────────────────────────────────────
// Token refresh (singleton promise)
// ─────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ─────────────────────────────────────────────
// Build URL with query params
// ─────────────────────────────────────────────

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

// ─────────────────────────────────────────────
// Core request function
// ─────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    params,
    headers = {},
    skipAuth = false,
    signal,
  } = options;

  const buildHeaders = (token: string | null): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };
    if (token && !skipAuth) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  const executeRequest = async (token: string | null): Promise<Response> => {
    return fetch(buildUrl(path, params), {
      method,
      headers: buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  };

  let token = skipAuth ? null : getAccessToken();
  let response = await executeRequest(token);

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth) {
    try {
      token = await refreshAccessToken();
      response = await executeRequest(token);
    } catch {
      throw { status: 401, message: 'Session expired. Please log in again.' } as ApiError;
    }
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error: ApiError = {
      status: response.status,
      message: extractErrorMessage(data),
      detail: data,
    };
    throw error;
  }

  return data as T;
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d['detail'] === 'string') return d['detail'];
    if (Array.isArray(d['detail'])) {
      const first = d['detail'][0] as Record<string, unknown>;
      return String(first?.msg || 'Validation error');
    }
    if (typeof d['message'] === 'string') return d['message'];
  }
  return 'An unexpected error occurred';
}

// ─────────────────────────────────────────────
// Exported API client
// ─────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string, params?: RequestOptions['params'], signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'GET', params, signal });
  },

  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'POST', body, signal });
  },

  patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'PATCH', body, signal });
  },

  put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'PUT', body, signal });
  },

  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'DELETE', signal });
  },

  postSkipAuth<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body, skipAuth: true });
  },

  setTokens,
  getAccessToken,
  clearTokens,
};