// src/pages/zones/ZonesPage.tsx

import { useState, useMemo, useCallback } from 'react';
import { MapPin, Plus, Search, RefreshCw, Filter } from 'lucide-react';

import { useZones, useZoneMutations }   from '../../hooks/useZones';
import { useZonePresence } from '../../hooks/useLocations';
import { useAuth } from '../../hooks/useAuth';

import { PageHeader } from '../../components/ui/SectionHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { ZoneTable } from '../../components/zones/ZoneTable';
import { ZoneCard } from '../../components/zones/ZoneCard';
import { ZoneForm } from '../../components/zones/ZoneForm';
import { RiskLevel } from '../../types/enums';
import type { ZoneWithStatus } from '../../types/zone';
import type {
  ZoneCreateCircularRequest,
  ZoneCreatePolygonRequest,
} from '../../types/zone';

// ─────────────────────────────────────────────
// Filter type
// ─────────────────────────────────────────────

type RiskFilter = 'all' | RiskLevel;
type ViewMode   = 'table' | 'cards';

// ─────────────────────────────────────────────
// ZonesPage
// ─────────────────────────────────────────────

export function ZonesPage() {
  const { isAdmin }   = useAuth();

  const { zones, isLoading, error, refetch }     = useZones();
  const { presence, getTouristCount }            = useZonePresence();
  const mutations                                = useZoneMutations(refetch);

  const [search,     setSearch]     = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [viewMode,   setViewMode]   = useState<ViewMode>('table');
  const [showCreate, setShowCreate] = useState(false);

  // ── Cast all zones to ZoneWithStatus ──
  const allZones = useMemo(() => zones as ZoneWithStatus[], [zones]);

  // ── Filtered zones ──
  const filtered = useMemo(() => {
    let list = allZones;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (z) => z.name.toLowerCase().includes(q) || z.zone_type?.toLowerCase().includes(q)
      );
    }
    if (riskFilter !== 'all') {
      list = list.filter((z) => z.risk_level === riskFilter);
    }
    return list;
  }, [allZones, search, riskFilter]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:  allZones.length,
    active: allZones.filter((z) => z.is_active).length,
    high:   allZones.filter((z) => z.risk_level === RiskLevel.HIGH).length,
    medium: allZones.filter((z) => z.risk_level === RiskLevel.MEDIUM).length,
    low:    allZones.filter((z) => z.risk_level === RiskLevel.LOW).length,
    tourists: presence.reduce((s, p) => s + p.tourist_count, 0),
  }), [allZones, presence]);

  // ── Create handlers ──
  const handleCreateCircular = useCallback(
    async (payload: ZoneCreateCircularRequest) => {
      await mutations.createCircular(payload);
      setShowCreate(false);
    },
    [mutations]
  );

  const handleCreatePolygon = useCallback(
    async (payload: ZoneCreatePolygonRequest) => {
      await mutations.createPolygon(payload);
      setShowCreate(false);
    },
    [mutations]
  );

  // ── Risk filter tabs ──
  const riskTabs = [
    { id: 'all',              label: 'All',    badge: allZones.length },
    { id: RiskLevel.HIGH,     label: 'High',   badge: stats.high },
    { id: RiskLevel.MEDIUM,   label: 'Medium', badge: stats.medium },
    { id: RiskLevel.LOW,      label: 'Low',    badge: stats.low },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Zone Management"
        subtitle="Monitor and manage all pilgrimage zones with live risk assessment"
        icon={<MapPin className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Zones' }]}
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
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreate(true)}
              >
                New Zone
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Total Zones"
          value={stats.total}
          icon={<MapPin className="w-full h-full" />}
          accent="blue"
          subtitle={`${stats.active} active`}
          isLoading={isLoading}
        />
        <StatCard
          title="High Risk"
          value={stats.high}
          icon={<Filter className="w-full h-full" />}
          accent={stats.high > 0 ? 'red' : 'emerald'}
          isLoading={isLoading}
        />
        <StatCard
          title="Medium Risk"
          value={stats.medium}
          icon={<Filter className="w-full h-full" />}
          accent="orange"
          isLoading={isLoading}
        />
        <StatCard
          title="Live Tourists"
          value={stats.tourists.toLocaleString()}
          icon={<MapPin className="w-full h-full" />}
          accent="cyan"
          subtitle="Across all zones"
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Main card */}
      <Card>
        <CardBody>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <SectionHeader
              title="All Zones"
              subtitle={`${filtered.length} of ${allZones.length} zones`}
              size="sm"
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                placeholder="Search zones…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputSize="sm"
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth={false}
                className="w-48"
              />

              {/* View toggle */}
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(['table', 'cards'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={[
                      'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                      viewMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                    ].join(' ')}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Risk filter tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-fit">
            {riskTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRiskFilter(tab.id as RiskFilter)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                  riskFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                ].join(' ')}
              >
                {tab.label}
                <span className={[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  riskFilter === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500',
                ].join(' ')}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Zone list */}
          {viewMode === 'table' ? (
            <ZoneTable
              zones={filtered}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  touristCount={getTouristCount(zone.id)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create zone modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Zone"
        description="Define a new monitored zone using circular or polygon boundaries"
        size="xl"
      >
        <ZoneForm
          onSubmitCircular={handleCreateCircular}
          onSubmitPolygon={handleCreatePolygon}
          existingZones={allZones}
          isSubmitting={mutations.isSubmitting}
          onCancel={() => setShowCreate(false)}
        />
        {mutations.error && (
          <p className="mt-3 text-xs text-red-500 dark:text-red-400">{mutations.error}</p>
        )}
      </Modal>
    </div>
  );
}
