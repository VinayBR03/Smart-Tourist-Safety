import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Config } from '@/constants/config';
import { SecureStorage } from '@/utils/storage';
import { useAuthStore } from '@/store/authStore';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown)  => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

// Routes that must NEVER trigger token refresh — they are auth routes themselves
const AUTH_ROUTES = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register'];

export const apiClient: AxiosInstance = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

// ── Request: attach access token ─────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStorage.get(Config.ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: silent token refresh ───────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url      = original?.url ?? '';

    // Never retry auth routes — prevents infinite loop after logout
    const isAuthRoute = AUTH_ROUTES.some((r) => url.includes(r));
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // If we have no tokens at all, user is logged out — don't retry
    const existingToken = await SecureStorage.get(Config.ACCESS_TOKEN_KEY);
    if (!existingToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      const refreshToken = await SecureStorage.get(Config.REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${Config.API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      await SecureStorage.set(Config.ACCESS_TOKEN_KEY, data.access_token);
      await SecureStorage.set(Config.REFRESH_TOKEN_KEY, data.refresh_token);

      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;

      return apiClient(original);
    } catch (err) {
      processQueue(err, null);
      // Tokens are invalid — clear everything and go to login
      await SecureStorage.clear([Config.ACCESS_TOKEN_KEY, Config.REFRESH_TOKEN_KEY]);
      useAuthStore.getState().logout();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);