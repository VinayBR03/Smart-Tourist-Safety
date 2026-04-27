// src/pages/health/HealthMonitoringPage.tsx

import { useState, useMemo, useCallback } from 'react';
import {
  HeartPulse,
  RefreshCw,
  Search,
  AlertCircle,
  Activity,
  Wind,
  Users,
} from 'lucide-react';

import {
  useLiveHealthTelemetry,
  useHealthAlerts,
} from '../../hooks/useHealthTelemetry';

import { PageHeader }             from '../../components/ui/SectionHeader';
import { SectionHeader }          from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }     from '../../components/ui/StatCard';
import { Card, CardBody }         from '../../components/ui/Card';
import { Button }                 from '../../components/common/Button';
import { Input }                  from '../../components/common/Input';
import { Badge }                  from '../../components/common/Badge';
import { EmptyState }             from '../../components/common/EmptyState';
import { SkeletonCard }           from '../../components/common/Skeleton';
import { HealthVitalCard }        from '../../components/health/HealthVitalCard';
import { HealthAlertCard }        from '../../components/health/HealthAlertCard';

import { formatTimeAgo }          from '../../utils/formatDate';
import type { HealthTelemetry }   from '../../types/health';

// ─────────────────────────────────────────────
// Tourist telemetry row
// ─────────────────────────────────────────────

function TouristTelemetryRow({
  entry,
  isSelected,
  onClick,
}: {
  entry:      HealthTelemetry;
  isSelected: boolean;
  onClick:    () => void;
}) {
  const isAlert = entry.is_alert;

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left p-3.5 rounded-xl border transition-all',
        isSelected
          ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
          : isAlert
          ? 'border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={[
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
            isAlert
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
          ].join(' ')}>
            {entry.tourist_id % 100}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Tourist {entry.tourist_id}
            </p>
            <p className="text-xs text-slate-400">
              {formatTimeAgo(entry.recorded_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isAlert && (
            <Badge variant="danger" size="sm" dot pulse>
              {entry.alert_type ?? 'Alert'}
            </Badge>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-mono text-red-500">
              {entry.heart_rate != null ? `${Math.round(entry.heart_rate)} bpm` : '—'}
            </p>
            <p className="text-xs font-mono text-blue-500">
              {entry.spo2 != null ? `${Math.round(entry.spo2)}% SpO₂` : '—'}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// HealthMonitoringPage
// ─────────────────────────────────────────────

export function HealthMonitoringPage() {
  const { telemetry, isLoading, error, refetch }   = useLiveHealthTelemetry();
  const { alerts, isLoading: alertsLoading }       = useHealthAlerts();

  const [search,      setSearch]      = useState('');
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:         telemetry.length,
    alerts:        telemetry.filter((t) => t.is_alert).length,
    highHR:        telemetry.filter((t) => t.heart_rate !== null && t.heart_rate > 100).length,
    lowSpO2:       telemetry.filter((t) => t.spo2 !== null && t.spo2 < 95).length,
    highTemp:      telemetry.filter((t) => t.body_temperature !== null && t.body_temperature > 37.5).length,
  }), [telemetry]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = telemetry;
    if (showAlertsOnly) list = list.filter((t) => t.is_alert);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        String(t.tourist_id).includes(q) ||
        t.alert_type?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      // Alerts first
      if (a.is_alert && !b.is_alert) return -1;
      if (!a.is_alert && b.is_alert) return 1;
      return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
    });
  }, [telemetry, search, showAlertsOnly]);

  // ── Selected tourist detail ──
  const selected = useMemo(
    () => telemetry.find((t) => t.tourist_id === selectedId) ?? null,
    [telemetry, selectedId]
  );

  const handleSelect = useCallback(
    (id: number) => setSelectedId((prev) => (prev === id ? null : id)),
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Health Monitoring"
        subtitle="Real-time vital signs and health alerts from wristband devices"
        icon={<HeartPulse className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Health' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={refetch}
            loading={isLoading}
          >
            Refresh
          </Button>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Tourists Monitored"
          value={stats.total}
          icon={<Users className="w-full h-full" />}
          accent="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Alerts"
          value={stats.alerts}
          icon={<AlertCircle className="w-full h-full" />}
          accent={stats.alerts > 0 ? 'red' : 'emerald'}
          isLoading={isLoading}
        />
        <StatCard
          title="High Heart Rate"
          value={stats.highHR}
          icon={<Activity className="w-full h-full" />}
          accent={stats.highHR > 0 ? 'orange' : 'slate'}
          subtitle="> 100 bpm"
          isLoading={isLoading}
        />
        <StatCard
          title="Low SpO₂"
          value={stats.lowSpO2}
          icon={<Wind className="w-full h-full" />}
          accent={stats.lowSpO2 > 0 ? 'red' : 'slate'}
          subtitle="< 95%"
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Active alerts section */}
      {!alertsLoading && alerts.length > 0 && (
        <Card variant="danger">
          <CardBody>
            <SectionHeader
              title={`Active Health Alerts (${alerts.length})`}
              subtitle="Tourists requiring immediate attention"
              size="sm"
              icon={<AlertCircle className="w-5 h-5" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alerts.slice(0, 6).map((alert, idx) => (
                <HealthAlertCard key={idx} alert={alert} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — list */}
        <div className="xl:col-span-2">
          <Card>
            <CardBody>
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4">
                <SectionHeader
                  title="Live Telemetry"
                  subtitle={`${filtered.length} tourists active`}
                  size="sm"
                />
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                  <Input
                    placeholder="Search tourist…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    inputSize="sm"
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth={false}
                    className="w-40"
                  />
                  <Button
                    variant={showAlertsOnly ? 'danger' : 'outline'}
                    size="sm"
                    onClick={() => setShowAlertsOnly((v) => !v)}
                  >
                    {showAlertsOnly ? 'Alerts Only' : 'Show All'}
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 text-sm text-red-500 py-4">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<HeartPulse className="w-8 h-8 text-slate-400" />}
                  title="No telemetry data"
                  message="No active tourist health data is available right now."
                  compact
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {filtered.map((entry) => (
                    <TouristTelemetryRow
                      key={`${entry.tourist_id}-${entry.id}`}
                      entry={entry}
                      isSelected={selectedId === entry.tourist_id}
                      onClick={() => handleSelect(entry.tourist_id)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right — detail panel */}
        <div>
          {selected ? (
            <Card className="sticky top-6">
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Tourist {selected.tourist_id}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Last updated {formatTimeAgo(selected.recorded_at)}
                    </p>
                  </div>
                  {selected.is_alert && (
                    <Badge variant="danger" dot pulse>
                      {selected.alert_type ?? 'Alert'}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <HealthVitalCard
                    type="heart_rate"
                    value={selected.heart_rate}
                    isAlert={selected.is_alert && selected.alert_type?.toLowerCase().includes('heart')}
                  />
                  <HealthVitalCard
                    type="spo2"
                    value={selected.spo2}
                    isAlert={selected.is_alert && selected.alert_type?.toLowerCase().includes('spo2')}
                  />
                  <HealthVitalCard
                    type="temperature"
                    value={selected.body_temperature}
                    isAlert={selected.is_alert && selected.alert_type?.toLowerCase().includes('temp')}
                  />
                </div>

                {selected.device_id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      Device
                    </p>
                    <code className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {selected.device_id}
                    </code>
                  </div>
                )}
              </CardBody>
            </Card>
          ) : (
            <Card className="sticky top-6">
              <CardBody>
                <EmptyState
                  icon={<HeartPulse className="w-8 h-8 text-slate-400" />}
                  title="Select a tourist"
                  message="Click any tourist to view their detailed vital signs"
                  compact
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
