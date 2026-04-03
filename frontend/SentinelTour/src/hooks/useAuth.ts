import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { wsClient } from '@/utils/websocket';
import { router } from 'expo-router';

export function useCurrentUser() {
  const { setUser, isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = await SecureStorage.get(Config.REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {/* silent */});
      }
    },
    onSettled: async () => {
      wsClient.disconnect();
      await logout();
      router.replace('/(auth)/login');
    },
  });
}