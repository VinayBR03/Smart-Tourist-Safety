import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { useNotificationStore } from '@/store/notificationStore';
import { wsClient } from '@/utils/websocket';
import type { WSNotificationEvent } from '@/types/api';

export function useNotifications() {
  const { setUnreadCount } = useNotificationStore();
  const queryClient = useQueryClient();

  // Initial fetch
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn:  notificationsApi.list,
    staleTime: 30_000,
  });

  // Unread count
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const data = await notificationsApi.unreadCount();
      setUnreadCount(data.unread_count);
      return data;
    },
    refetchInterval: 60_000,
  });

  // WebSocket push
  useEffect(() => {
    const handler = (_: WSNotificationEvent) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    wsClient.on('notification', handler as any);
    return () => wsClient.off('notification', handler as any);
  }, [queryClient]);

  return query;
}