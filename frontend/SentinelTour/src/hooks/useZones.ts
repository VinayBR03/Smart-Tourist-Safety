import { useQuery } from '@tanstack/react-query';
import { zonesApi } from '@/api/zones';

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn:  zonesApi.list,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}