// src/pages/incidents/IncidentListPage.tsx

import { useState, useMemo, useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Filter,
} from 'lucide-react';

import { useIncidents }         from '../../hooks/useIncidents';
import { useZones }             from '../../hooks/useZones';
import { useAuth }              from '../../hooks/useAuth';

import { createIncident }       from '../../api/incidentApi';

import { PageHeader }           from '../../components/ui/SectionHeader';
import { SectionHeader }        from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }   from '../../components/ui/StatCard';
import { Card, CardBody }       from '../../components/ui/Card';
import { Button }               from '../../components/common/Button';
import { Input }                from '../../components/common/Input';
import { Modal }                from '../../components/common/Modal';
import { IncidentTable }        from '../../components/incidents/IncidentTable';
import { IncidentForm }         from '../../components/incidents/IncidentForm';

import { IncidentStatus, IncidentSource } from '../../types/enums';
import type { IncidentCreateRequest }     from '../../types/incident';
import type { ZoneWithStatus }            from '../../types/zone';

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'resolved' | IncidentStatus;
type SourceFilter = 'all' | IncidentSource;

// ─────────────────────────────────────────────
// IncidentListPage
// ─────────────────────────────────────────────

export function IncidentListPage() {
  const navigate                  = useNavigate();
  const { isAdmin, isAuthority }  = useAuth();

  const { incidents, isLoading, error, refetch } = useIncidents();
  const { zones }                                = useZones();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);

  // ── Zone lookup map ──
  const zoneNames = useMemo(
    () => Object.fromEntries((zones as ZoneWithStatus[]).map((z) => [z.id, z.name])),
    [zones]
  );

  // ── Stats ──
  const stats = useMemo(() => ({
    total:       incidents.length,
    open:        incidents.filter((i) => i.status === IncidentStatus.OPEN).length,
    escalated:   incidents.filter((i) => i.status === IncidentStatus.ESCALATED).length,
    inProgress:  incidents.filter((i) => i.status === IncidentStatus.IN_PROGRESS).length,
    resolved:    incidents.filter((i) =>
      i.status === IncidentStatus.RESOLVED || i.status === IncidentStatus.CLOSED
    ).length,
    autoGen:     incidents.filter((i) => i.is_auto_generated).length,
  }), [incidents]);

  // ── Filtered incidents ──
  const filtered = useMemo(() => {
    let list = incidents;

    // status filter
    if (statusFilter === 'active') {
      list = list.filter((i) =>
        i.status === IncidentStatus.OPEN ||
        i.status === IncidentStatus.IN_PROGRESS ||
        i.status === IncidentStatus.ESCALATED
      );
    } else if (statusFilter === 'resolved') {
      list = list.filter((i) =>
        i.status === IncidentStatus.RESOLVED ||
        i.status === IncidentStatus.CLOSED
      );
    } else if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }

    // source filter
    if (sourceFilter !== 'all') {
      list = list.filter((i) => i.source === sourceFilter);
    }

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        String(i.id).includes(q) ||
        i.status.toLowerCase().includes(q) ||
        (i.zone_id && zoneNames[i.zone_id]?.toLowerCase().includes(q))
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [incidents, statusFilter, sourceFilter, search, zoneNames]);

  // ── Status filter tabs ──
  const statusTabs = [
    { id: 'all',      label: 'All',       badge: stats.total },
    { id: 'active',   label: 'Active',    badge: stats.open + stats.inProgress + stats.escalated },
    { id: 'resolved', label: 'Resolved',  badge: stats.resolved },
  ];

  // ── Create handler ──
  const handleCreate = useCallback(
    async (payload: IncidentCreateRequest) => {
      setIsCreating(true);
      setCreateError(null);
      try {
        await createIncident(payload);
        await refetch();
        setShowCreate(false);
      } catch (err: unknown) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create incident.');
      } finally {
        setIsCreating(false);
      }
    },
    [refetch]
  );

  const canCreate = isAdmin || isAuthority;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Incident Management"
        subtitle="Track and manage all reported incidents across the pilgrimage event"
        icon={<AlertTriangle className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Incidents' }]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={refetch}
              loading={isLoading}
            >
              Refresh
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreate(true)}
              >
                Report Incident
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Open"
          value={stats.open}
          icon={<AlertTriangle className="w-full h-full" />}
          accent={stats.open > 0 ? 'red' : 'emerald'}
          isLoading={isLoading}
        />
        <StatCard
          title="Escalated"
          value={stats.escalated}
          icon={<Filter className="w-full h-full" />}
          accent={stats.escalated > 0 ? 'red' : 'slate'}
          isLoading={isLoading}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<RefreshCw className="w-full h-full" />}
          accent="orange"
          isLoading={isLoading}
        />
        <StatCard
          title="Resolved / Closed"
          value={stats.resolved}
          icon={<AlertTriangle className="w-full h-full" />}
          accent="emerald"
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Main table card */}
      <Card>
        <CardBody>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <SectionHeader
              title="All Incidents"
              subtitle={`${filtered.length} of ${incidents.length} incidents`}
              size="sm"
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                placeholder="Search incidents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputSize="sm"
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth={false}
                className="w-48"
              />

              {/* Source filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sources</option>
                {Object.values(IncidentSource).map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-fit">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
                <span className={[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  statusFilter === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500',
                ].join(' ')}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <IncidentTable
            incidents={filtered}
            isLoading={isLoading}
            error={error}
            onRowClick={(inc) => navigate(`/incidents/${inc.id}`)}
            zoneNames={zoneNames}
          />
        </CardBody>
      </Card>

      {/* Create incident modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(null); }}
        title="Report New Incident"
        description="Manually report an incident for immediate dispatch"
        size="md"
      >
        <IncidentForm
          onSubmit={handleCreate}
          isSubmitting={isCreating}
          onCancel={() => setShowCreate(false)}
        />
        {createError && (
          <p className="mt-3 text-xs text-red-500 dark:text-red-400">{createError}</p>
        )}
      </Modal>
    </div>
  );
}
