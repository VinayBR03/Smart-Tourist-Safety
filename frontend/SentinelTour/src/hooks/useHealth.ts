import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/api/health';
import { useAuthStore } from '@/store/authStore';
import { Config } from '@/constants/config';

export function useLatestHealth() {
  return useQuery({
    queryKey: ['health', 'latest'],
    queryFn:  healthApi.getLatest,
    refetchInterval: Config.HEALTH_POLL_INTERVAL,
    retry: false,
  });
}

export function useHealthHistory(limit = 50) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['health', 'history', user?.id, limit],
    queryFn:  () => healthApi.getHistory(user!.id, limit),
    enabled:  !!user?.id,
    staleTime: 30_000,
  });
}