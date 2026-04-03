import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentsApi } from '@/api/incidents';
import type {
  CreateIncidentRequest,
  IncidentStatus,
  IncidentSummary,
  IncidentDetail,
  IncidentTimelineEntry,
} from '@/types/api';

// ─── List my incidents with optional status filter ────────
export function useMyIncidents(statusFilter?: IncidentStatus) {
  return useQuery({
    queryKey: ['incidents', 'me', statusFilter ?? 'ALL'],
    queryFn:  () =>
      incidentsApi.listMine({
        limit:         100,
        offset:        0,
        status_filter: statusFilter,
      }),
    staleTime:      30_000,
    refetchInterval: 60_000,
  });
}

// ─── Fetch a single incident by ID ────────────────────────
export function useIncident(id: number | null) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn:  () => incidentsApi.getById(id!),
    enabled:  id != null && id > 0,
    staleTime: 30_000,
  });
}

// ─── Fetch incident timeline ──────────────────────────────
export function useIncidentTimeline(incidentId: number | null) {
  return useQuery({
    queryKey: ['incident', incidentId, 'timeline'],
    queryFn:  () => incidentsApi.getTimeline(incidentId!),
    enabled:  incidentId != null && incidentId > 0,
    staleTime: 60_000,
  });
}

// ─── Create a new incident (SOS or manual report) ─────────
export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateIncidentRequest) =>
      incidentsApi.create(payload),

    onSuccess: (newIncident) => {
      // Prepend new incident to the cached list so UI updates instantly
      queryClient.setQueryData<IncidentSummary[]>(
        ['incidents', 'me', 'ALL'],
        (old = []) => [newIncident as unknown as IncidentSummary, ...old]
      );

      // Also seed the individual incident cache so detail page doesn't refetch
      queryClient.setQueryData<IncidentDetail>(
        ['incident', newIncident.id],
        newIncident
      );

      // Invalidate so next poll gets authoritative server list
      queryClient.invalidateQueries({ queryKey: ['incidents', 'me'] });
    },

    onError: (err: any) => {
      console.error(
        '[Incidents] Create failed:',
        err?.response?.status,
        err?.response?.data ?? err?.message
      );
    },
  });
}

// ─── Convenience: open incidents count for badge/dashboard ─
export function useOpenIncidentCount() {
  const { data = [] } = useMyIncidents();
  return data.filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS' || i.status === 'ESCALATED'
  ).length;
}

// ─── Prefetch incident detail (call on list item hover/press) ─
export function usePrefetchIncident() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: number) => {
      queryClient.prefetchQuery({
        queryKey: ['incident', id],
        queryFn:  () => incidentsApi.getById(id),
        staleTime: 30_000,
      });
    },
    [queryClient]
  );
}