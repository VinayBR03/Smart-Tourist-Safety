import { apiClient } from './client';
import type { User, UserLanguage } from '@/types/api';

// Normalise preferred_language to lowercase on every user object
// because some DB rows have "EN" (uppercase) from earlier registrations
function normaliseUser(user: User): User {
  return {
    ...user,
    preferred_language: user.preferred_language
      ? (user.preferred_language.toLowerCase() as UserLanguage)
      : 'en',
  };
}

export const authApi = {
  register: (data: Record<string, unknown>) =>
    apiClient.post<User>('/auth/register', data).then((r) => normaliseUser(r.data)),

  login: (data: { email: string; password: string; device_info?: string }) =>
    apiClient.post<{
      access_token:  string;
      refresh_token: string;
      token_type:    string;
      expires_in:    number;
    }>('/auth/login', data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient
      .post<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }>(
        '/auth/refresh', { refresh_token }
      )
      .then((r) => r.data),

  logout: (refresh_token: string) =>
    apiClient.post('/auth/logout', { refresh_token }),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => normaliseUser(r.data)),

  changePassword: (
    current_password: string,
    new_password:     string,
    confirm_password: string
  ) =>
    apiClient.post('/auth/change-password', {
      current_password,
      new_password,
      confirm_password,
    }),

  // Sends only non-empty fields and always lowercases preferred_language
  updateProfile: (updates: Partial<User>) => {
    const payload: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (typeof value === 'string' && value.trim() === '') return;

      if (key === 'preferred_language' && typeof value === 'string') {
        payload[key] = value.toLowerCase();
      } else {
        payload[key] = value;
      }
    });

    return apiClient.patch<User>('/tourists/me', payload).then((r) => normaliseUser(r.data));
  },
};