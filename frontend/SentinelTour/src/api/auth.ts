import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from '@/types/api';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<User>('/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  logout: (refresh_token: string) =>
    apiClient.post('/auth/logout', { refresh_token }),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    apiClient.post('/auth/change-password', {
      current_password,
      new_password,
      confirm_password,
    }),

  updateProfile: (updates: Partial<User>) =>
    apiClient.patch('/tourists/me', updates).then((r) => r.data),
};