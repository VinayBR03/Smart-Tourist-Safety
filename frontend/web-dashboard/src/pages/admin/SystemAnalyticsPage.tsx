// src/pages/admin/SystemAnalyticsPage.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  RefreshCw,
  Users,
  Shield,
  Cpu,
  AlertTriangle,
  TrendingUp,
  Database,
  CheckCircle,
} from 'lucide-react';

import {
  getIncidentTrend,
  getIncidentStatusCounts,
  getZoneRiskCounts,
  getDeviceHealthCounts,
  getDeviceBatteryDistribution,
} from '../../api/analyticsApi';
import { listUsers }            from '../../api/userApi';
import { useZones }             from '../../hooks/useZones';
import { useZonePresence }      from '../../hooks/useLocations';
import { useIncidents }         from '../../hooks/useIncidents';

import { PageHeader }           from '../../components/ui/SectionHeader';
import { SectionHeader }        from '../../components/ui/SectionHeader';
import { StatCard, StatGrid, MiniStat } from '../../components/ui/StatCard';
import { Card, CardBody }       from '../../components/ui/Card';
import { Button }               from '../../components/common/Button';
import { Badge }                from '../../components/common/Badge';

import { IncidentTrendChart }   from '../../components/charts/IncidentTrendChart';
import { IncidentStatusChart }  from '../../components/charts/IncidentStatusChart';
import { ZoneRiskChart }        from '../../components/charts/ZoneRiskChart';
import { DeviceHealthChart }    from '../../components/charts/DeviceHealthChart';
import { CrowdDensityChart }    from '../../components/charts/CrowdDensityChart';

import { UserRole, IncidentStatus, RiskLevel } from '../../types/enums';
import type { UserAdminResponse } from '../../types/user';
import type { ZoneWithStatus }    from '../../types/zone';
import type {
  IncidentTrendResponse,
  IncidentStatusResponse,
  ZoneRiskResponse,
  DeviceHealthResponse,
  DeviceBatteryDistributionResponse,
} from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Aggregate hook
// ─────────────────────────────────────────────

interface SystemData {
  trend:      IncidentTrendResponse   | null;
  incStatus:  IncidentStatusResponse  | null;
  zoneRisk:   ZoneRiskResponse        | null;
  devHealth:  DeviceHealthResponse    | null;
  battery:    DeviceBatteryDistributionResponse | null;
  users:      UserAdminResponse[];
}

function useSystemData() {
  const [data,    setData]    = useState<SystemData>({
    trend: null, incStatus: null, zoneRisk: null,
    devHealth: null, battery: null, users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        getIncidentTrend(),
        getIncidentStatusCounts(),
        getZoneRiskCounts(),
        getDeviceHealthCounts(),
        getDeviceBatteryDistribution(),
        listUsers(),
      ]);

      setData({
        trend:     results[0].status === 'fulfilled' ? (results[0].value as IncidentTrendResponse)   : null,
        incStatus: results[1].status === 'fulfilled' ? (results[1].value as IncidentStatusResponse)  : null,
        zoneRisk:  results[2].status === 'fulfilled' ? (results[2].value as ZoneRiskResponse)        : null,
        devHealth: results[3].status === 'fulfilled' ? (results[3].value as DeviceHealthResponse)    : null,
        battery:   results[4].status === 'fulfilled' ? (results[4].value as DeviceBatteryDistributionResponse) : null,
        users:     results[5].status === 'fulfilled' ? (results[5].value as UserAdminResponse[])     : [],
      });

      setLastRun(new Date());
    } catch {
      setError('Failed to load system data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const triggerLoad = async () => {
      await load();
    };
    triggerLoad();
  }, [load]);
  return { data, loading, error, reload: load, lastRun };
}

// ─────────────────────────────────────────────
// Health check row
// ─────────────────────────────────────────────

function SystemHealthRow({
  label,
  status,
  detail,
}: {
  label:  string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}) {
  const colors = {
    ok:    'text-emerald-500',
    warn:  'text-amber-500',
    error: 'text-red-500',
  };
  const icons = {
    ok:    <CheckCircle className="w-4 h-4" />,
    warn:  <AlertTriangle className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className={colors[status]}>{icons[status]}</span>
      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <span className={`text-xs font-medium ${colors[status]}`}>{detail}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// SystemAnalyticsPage
// ─────────────────────────────────────────────

export function SystemAnalyticsPage() {
  const { data, loading, reload, lastRun } = useSystemData();
  const { zones }          = useZones();
  const { presence }                               = useZonePresence();
  const { incidents }                              = useIncidents();

  const allZones = useMemo(() => zones as ZoneWithStatus[], [zones]);

  // ── Derived platform stats ──
  const platform = useMemo(() => {
    const u = data.users;
    const d = data.devHealth?.status_counts;

    const totalIncidents = data.incStatus
      ? Object.values(data.incStatus.status_counts).reduce((s, v) => s + v, 0)
      : 0;

    const resolvedIncidents = data.incStatus
      ? (data.incStatus.status_counts.RESOLVED + data.incStatus.status_counts.CLOSED)
      : 0;

    const resolutionRate = totalIncidents > 0
      ? Math.round((resolvedIncidents / totalIncidents) * 100)
      : 0;

    const activeDevices  = d?.ACTIVE        ?? 0;
    const totalDevices   = d ? Object.values(d).reduce((s, v) => s + v, 0) : 0;
    const deviceUptime   = totalDevices > 0 ? Math.round((activeDevices / totalDevices) * 100) : 0;

    return {
      tourists:        u.filter((x) => x.role === UserRole.TOURIST).length,
      authorities:     u.filter((x) => x.role === UserRole.AUTHORITY).length,
      admins:          u.filter((x) => x.role === UserRole.ADMIN).length,
      activeUsers:     u.filter((x) => x.is_active).length,
      totalIncidents,
      resolvedIncidents,
      resolutionRate,
      openIncidents:   incidents.filter((i) => i.status === IncidentStatus.OPEN).length,
      escalated:       incidents.filter((i) => i.status === IncidentStatus.ESCALATED).length,
      totalDevices,
      activeDevices,
      deviceUptime,
      lostDevices:     d?.LOST ?? 0,
      totalZones:      allZones.length,
      activeZones:     allZones.filter((z) => z.is_active).length,
      highRisk:        allZones.filter((z) => z.risk_level === RiskLevel.HIGH).length,
      liveTourists:    presence.reduce((s, p) => s + p.tourist_count, 0),
    };
  }, [data, allZones, presence, incidents]);

  // ── System health checks ──
  const healthChecks = useMemo(() => [
    {
      label:  'Incident Resolution Rate',
      status: (platform.resolutionRate >= 80 ? 'ok' : platform.resolutionRate >= 50 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
      detail: `${platform.resolutionRate}%`,
    },
    {
      label:  'Device Uptime',
      status: (platform.deviceUptime >= 90 ? 'ok' : platform.deviceUptime >= 70 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
      detail: `${platform.deviceUptime}% active`,
    },
    {
      label:  'High Risk Zones',
      status: (platform.highRisk === 0 ? 'ok' : platform.highRisk <= 2 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
      detail: `${platform.highRisk} zone${platform.highRisk !== 1 ? 's' : ''}`,
    },
    {
      label:  'Escalated Incidents',
      status: (platform.escalated === 0 ? 'ok' : platform.escalated <= 2 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
      detail: `${platform.escalated} active`,
    },
    {
      label:  'Lost Devices',
      status: (platform.lostDevices === 0 ? 'ok' : platform.lostDevices <= 3 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
      detail: `${platform.lostDevices} device${platform.lostDevices !== 1 ? 's' : ''}`,
    },
    {
      label:  'Data Pipeline',
      status: 'ok' as const,
      detail: 'Operational',
    },
  ], [platform]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="System Analytics"
        subtitle="Full platform health, user metrics, and operational KPIs for administrators"
        icon={<Activity className="w-5 h-5" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Admin' },
          { label: 'System Analytics' },
        ]}
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
              Refresh All
            </Button>
          </div>
        }
      />

      {/* Top KPIs */}
      <StatGrid cols={4}>
        <StatCard
          title="Live Tourists"
          value={platform.liveTourists.toLocaleString()}
          icon={<Users className="w-full h-full" />}
          accent="blue"
          subtitle="In active zones"
          isLoading={loading}
        />
        <StatCard
          title="Resolution Rate"
          value={`${platform.resolutionRate}%`}
          icon={<TrendingUp className="w-full h-full" />}
          accent={platform.resolutionRate >= 80 ? 'emerald' : platform.resolutionRate >= 50 ? 'orange' : 'red'}
          subtitle={`${platform.resolvedIncidents} / ${platform.totalIncidents} resolved`}
          isLoading={loading}
        />
        <StatCard
          title="Device Uptime"
          value={`${platform.deviceUptime}%`}
          icon={<Cpu className="w-full h-full" />}
          accent={platform.deviceUptime >= 90 ? 'emerald' : 'orange'}
          subtitle={`${platform.activeDevices} / ${platform.totalDevices} active`}
          isLoading={loading}
        />
        <StatCard
          title="Open Incidents"
          value={platform.openIncidents}
          icon={<AlertTriangle className="w-full h-full" />}
          accent={platform.openIncidents > 0 ? 'red' : 'emerald'}
          subtitle={`${platform.escalated} escalated`}
          isLoading={false}
        />
      </StatGrid>

      {/* System health + User breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System health */}
        <Card>
          <CardBody>
            <SectionHeader
              title="System Health Checks"
              icon={<Activity className="w-5 h-5" />}
              size="sm"
              divider
            />
            <div>
              {healthChecks.map((check) => (
                <SystemHealthRow
                  key={check.label}
                  label={check.label}
                  status={check.status}
                  detail={check.detail}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Platform users */}
        <Card>
          <CardBody>
            <SectionHeader
              title="Platform Users"
              icon={<Users className="w-5 h-5" />}
              size="sm"
              divider
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MiniStat
                label="Tourists"
                value={platform.tourists.toLocaleString()}
                icon={<Users className="w-4 h-4" />}
                accent="emerald"
                isLoading={loading}
              />
              <MiniStat
                label="Authorities"
                value={platform.authorities}
                icon={<Shield className="w-4 h-4" />}
                accent="blue"
                isLoading={loading}
              />
              <MiniStat
                label="Admins"
                value={platform.admins}
                icon={<Shield className="w-4 h-4" />}
                accent="purple"
                isLoading={loading}
              />
              <MiniStat
                label="Active Users"
                value={platform.activeUsers.toLocaleString()}
                icon={<Users className="w-4 h-4" />}
                accent="cyan"
                isLoading={loading}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Zone Overview
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{platform.totalZones}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Total</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{platform.activeZones}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase">Active</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{platform.highRisk}</p>
                  <p className="text-[10px] text-red-600 dark:text-red-500 uppercase">High Risk</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Incident trend — full width */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Incident Volume — 30 Day Trend"
            subtitle="Daily incident reporting volume to identify patterns and anomalies"
            icon={<TrendingUp className="w-5 h-5" />}
            size="sm"
            divider
          />
          <IncidentTrendChart
            data={data.trend}
            isLoading={loading}
            height={280}
          />
        </CardBody>
      </Card>

      {/* Middle row: Incident status + Zone risk + Device health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <SectionHeader
              title="Incident Status"
              size="sm"
              divider
            />
            <IncidentStatusChart
              data={data.incStatus}
              isLoading={loading}
              height={240}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader
              title="Zone Risk"
              size="sm"
              divider
            />
            <ZoneRiskChart
              data={data.zoneRisk}
              isLoading={loading}
              height={240}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader
              title="Crowd Density"
              size="sm"
              divider
            />
            <CrowdDensityChart
              data={presence}
              isLoading={false}
              height={240}
            />
          </CardBody>
        </Card>
      </div>

      {/* Device health */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Device Fleet Health"
            subtitle="Overall status and battery distribution across all registered devices"
            icon={<Cpu className="w-5 h-5" />}
            size="sm"
            divider
          />
          <DeviceHealthChart
            healthData={data.devHealth}
            batteryData={data.battery}
            isLoading={loading}
            height={280}
          />
        </CardBody>
      </Card>

      {/* Data sources status */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Data Sources"
            icon={<Database className="w-5 h-5" />}
            size="sm"
            divider
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Incident Trend',   ok: !!data.trend },
              { label: 'Status Breakdown', ok: !!data.incStatus },
              { label: 'Zone Risk',        ok: !!data.zoneRisk },
              { label: 'Device Health',    ok: !!data.devHealth },
              { label: 'Battery Data',     ok: !!data.battery },
            ].map(({ label, ok }) => (
              <div
                key={label}
                className={[
                  'flex flex-col items-center gap-2 p-3 rounded-xl border text-center',
                  ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40',
                ].join(' ')}
              >
                {ok
                  ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                  : <AlertTriangle className="w-5 h-5 text-red-500" />
                }
                <p className={[
                  'text-xs font-medium',
                  ok
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400',
                ].join(' ')}>
                  {label}
                </p>
                <Badge variant={ok ? 'success' : 'danger'} size="sm">
                  {ok ? 'OK' : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
