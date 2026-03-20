// src/pages/analytics/OperationsAnalyticsPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';

import { PageHeader }             from '../../components/ui/SectionHeader';
import { SectionHeader }          from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }     from '../../components/ui/StatCard';
import { Card, CardBody }         from '../../components/ui/Card';
import { Button }                 from '../../components/common/Button';

import { IncidentTrendChart }     from '../../components/charts/IncidentTrendChart';
import { IncidentStatusChart }    from '../../components/charts/IncidentStatusChart';
import { ZoneRiskChart }          from '../../components/charts/ZoneRiskChart';
import { DeviceHealthChart }      from '../../components/charts/DeviceHealthChart';
import { CrowdDensityChart }      from '../../components/charts/CrowdDensityChart';

import {
  getIncidentTrend,
  getIncidentStatusCounts,
  getZoneRiskCounts,
  getDeviceHealthCounts,
  getDeviceBatteryDistribution,
} from '../../api/analyticsApi';
import { useZonePresence } from '../../hooks/useLocations';

import type {
  IncidentTrendResponse,
  IncidentStatusResponse,
  ZoneRiskResponse,
  DeviceHealthResponse,
  DeviceBatteryDistributionResponse,
} from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Hook: load all analytics
// ─────────────────────────────────────────────

interface AnalyticsData {
  trend:   IncidentTrendResponse   | null;
  status:  IncidentStatusResponse  | null;
  risk:    ZoneRiskResponse        | null;
  devices: DeviceHealthResponse    | null;
  battery: DeviceBatteryDistributionResponse | null;
}

function useAnalytics() {
  const [data,    setData]    = useState<AnalyticsData>({
    trend: null, status: null, risk: null, devices: null, battery: null,
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trend, status, risk, devices, battery] = await Promise.allSettled([
        getIncidentTrend(),
        getIncidentStatusCounts(),
        getZoneRiskCounts(),
        getDeviceHealthCounts(),
        getDeviceBatteryDistribution(),
      ]);

      setData({
        trend:   trend.status   === 'fulfilled' ? trend.value   : null,
        status:  status.status  === 'fulfilled' ? status.value  : null,
        risk:    risk.status    === 'fulfilled' ? risk.value    : null,
        devices: devices.status === 'fulfilled' ? devices.value : null,
        battery: battery.status === 'fulfilled' ? battery.value : null,
      });

      setLastRun(new Date());

      const failures = [trend, status, risk, devices, battery].filter(
        (r) => r.status === 'rejected'
      );
      if (failures.length > 0) setError(`${failures.length} data source(s) failed to load.`);
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, lastRun };
}

// ─────────────────────────────────────────────
// OperationsAnalyticsPage
// ─────────────────────────────────────────────

export function OperationsAnalyticsPage() {
  const { data, loading, error, reload, lastRun } = useAnalytics();
  const { presence }                              = useZonePresence();

  // ── Derived totals ──
  const totalIncidents = data.status
    ? Object.values(data.status.status_counts).reduce((s, v) => s + v, 0)
    : null;

  const totalActiveDevices = data.devices?.status_counts.ACTIVE ?? null;

  const totalHighRisk = data.risk?.risk_counts.HIGH ?? null;

  const totalTourists = presence.reduce((s, p) => s + p.tourist_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Operations Analytics"
        subtitle="Comprehensive metrics and trends for incident management and device health"
        icon={<BarChart2 className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics' }]}
        action={
          <div className="flex items-center gap-2">
            {lastRun && (
              <span className="text-xs text-slate-400">
                Updated {lastRun.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={reload}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Partial error notice */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{error}</p>
        </div>
      )}

      {/* Summary stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Total Incidents"
          value={totalIncidents ?? '—'}
          icon={<AlertCircle className="w-full h-full" />}
          accent="red"
          isLoading={loading}
          subtitle="All time"
        />
        <StatCard
          title="Active Devices"
          value={totalActiveDevices ?? '—'}
          icon={<TrendingUp className="w-full h-full" />}
          accent="emerald"
          isLoading={loading}
        />
        <StatCard
          title="High Risk Zones"
          value={totalHighRisk ?? '—'}
          icon={<AlertCircle className="w-full h-full" />}
          accent={totalHighRisk != null && totalHighRisk > 0 ? 'orange' : 'slate'}
          isLoading={loading}
        />
        <StatCard
          title="Live Tourists"
          value={totalTourists.toLocaleString()}
          icon={<BarChart2 className="w-full h-full" />}
          accent="blue"
          subtitle="Across all zones"
        />
      </StatGrid>

      {/* Incident trend — full width */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Incident Trend — Last 30 Days"
            subtitle="Daily volume of incidents reported across the event"
            icon={<TrendingUp className="w-5 h-5" />}
            size="sm"
            divider
          />
          <IncidentTrendChart
            data={data.trend}
            isLoading={loading}
            height={300}
          />
        </CardBody>
      </Card>

      {/* Row: Incident status + Zone risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionHeader
              title="Incident Status Breakdown"
              subtitle="Distribution across all status categories"
              size="sm"
              divider
            />
            <IncidentStatusChart
              data={data.status}
              isLoading={loading}
              height={280}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader
              title="Zone Risk Distribution"
              subtitle="Count of zones by current risk level"
              size="sm"
              divider
            />
            <ZoneRiskChart
              data={data.risk}
              isLoading={loading}
              height={280}
            />
          </CardBody>
        </Card>
      </div>

      {/* Row: Device health + Battery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionHeader
              title="Device Health Overview"
              subtitle="Status and battery distribution across all devices"
              size="sm"
              divider
            />
            <DeviceHealthChart
              healthData={data.devices}
              batteryData={data.battery}
              isLoading={loading}
              height={280}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader
              title="Live Crowd Density"
              subtitle="Current tourist count per monitored zone"
              size="sm"
              divider
            />
            <CrowdDensityChart
              data={presence}
              isLoading={false}
              height={280}
            />
          </CardBody>
        </Card>
      </div>

      {/* Device status counts table */}
      {data.devices && (
        <Card>
          <CardBody>
            <SectionHeader
              title="Device Status Summary"
              subtitle="Breakdown of all registered devices by operational status"
              size="sm"
              divider
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.entries(data.devices.status_counts) as [string, number][]).map(([status, count]) => (
                <div
                  key={status}
                  className="flex flex-col items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"
                >
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{count}</p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-center">
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
