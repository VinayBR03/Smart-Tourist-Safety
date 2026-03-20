// src/pages/dashboard/DashboardPage.tsx

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  MapPin,
  Cpu,
  HeartPulse,
  RefreshCw,
  Activity,
  Users,
} from 'lucide-react';

import { useAuth }              from '../../hooks/useAuth';
import { useIncidents }         from '../../hooks/useIncidents';
import { useZones }             from '../../hooks/useZones';
import { useDevices }           from '../../hooks/useDevices';
import { useHealthAlerts }      from '../../hooks/useHealthTelemetry';
import { useZonePresence }      from '../../hooks/useLocations';

import { PageHeader }           from '../../components/ui/SectionHeader';
import { SectionHeader }        from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }   from '../../components/ui/StatCard';
import { Card, CardBody }       from '../../components/ui/Card';
import { Button }               from '../../components/common/Button';
import { IncidentTable }        from '../../components/incidents/IncidentTable';
import { ZoneTable }            from '../../components/zones/ZoneTable';

import { IncidentTrendChart }   from '../../components/charts/IncidentTrendChart';
import { IncidentStatusChart }  from '../../components/charts/IncidentStatusChart';
import { ZoneRiskChart }        from '../../components/charts/ZoneRiskChart';
import { CrowdDensityChart }    from '../../components/charts/CrowdDensityChart';

import {
  getIncidentTrend,
  getIncidentStatusCounts,
  getZoneRiskCounts,
} from '../../api/analyticsApi';

import { useState, useEffect } from 'react';
import type {
  IncidentTrendResponse,
  IncidentStatusResponse,
  ZoneRiskResponse,
} from '../../api/analyticsApi';

import { IncidentStatus, RiskLevel, DeviceStatus } from '../../types/enums';
import type { ZoneWithStatus } from '../../types/zone';

// ─────────────────────────────────────────────
// Helper hook: analytics
// ─────────────────────────────────────────────

function useDashboardAnalytics() {
  const [trend,    setTrend]    = useState<IncidentTrendResponse | null>(null);
  const [status,   setStatus]   = useState<IncidentStatusResponse | null>(null);
  const [zoneRisk, setZoneRisk] = useState<ZoneRiskResponse | null>(null);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [t, s, z] = await Promise.allSettled([
        getIncidentTrend(),
        getIncidentStatusCounts(),
        getZoneRiskCounts(),
      ]);
      if (t.status === 'fulfilled') setTrend(t.value);
      if (s.status === 'fulfilled') setStatus(s.value);
      if (z.status === 'fulfilled') setZoneRisk(z.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  return { trend, status, zoneRisk, loading, reload: load };
}

// ─────────────────────────────────────────────
// DashboardPage
// ─────────────────────────────────────────────

export function DashboardPage() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const { incidents, isLoading: incLoading, refetch: refetchInc }    = useIncidents();
  const { zones,     isLoading: zoneLoading }                         = useZones();
  const { devices,   isLoading: devLoading }                          = useDevices();
  const { alerts,    isLoading: alertLoading }                        = useHealthAlerts();
  const { presence }                                                  = useZonePresence();
  const { trend, status, zoneRisk, loading: analyticsLoading, reload }= useDashboardAnalytics();

  // ── Derived stats ──

  const openIncidents  = useMemo(() =>
    incidents.filter((i) => i.status === IncidentStatus.OPEN || i.status === IncidentStatus.ESCALATED).length,
    [incidents]
  );

  const highRiskZones  = useMemo(() =>
    zones.filter((z) => (z as ZoneWithStatus).risk_level === RiskLevel.HIGH).length,
    [zones]
  );

  const activeDevices  = useMemo(() =>
    devices.filter((d) => d.status === DeviceStatus.ACTIVE).length,
    [devices]
  );

  const recentIncidents = useMemo(() =>
    [...incidents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8),
    [incidents]
  );

  const zonesWithStatus = useMemo(() =>
    zones as ZoneWithStatus[],
    [zones]
  );

  const totalPresence = useMemo(() =>
    presence.reduce((sum, p) => sum + p.tourist_count, 0),
    [presence]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={`${greeting}, ${user?.full_name?.split(' ')[0] ?? 'Commander'}`}
        subtitle="Here's your operational overview for today"
        icon={<Activity className="w-5 h-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => { refetchInc(); reload(); }}
          >
            Refresh
          </Button>
        }
      />

      {/* KPI stat cards */}
      <StatGrid cols={4}>
        <StatCard
          title="Open Incidents"
          value={openIncidents}
          icon={<AlertTriangle className="w-full h-full" />}
          accent={openIncidents > 0 ? 'red' : 'emerald'}
          subtitle={`${incidents.length} total reported`}
          isLoading={incLoading}
          onClick={() => navigate('/incidents')}
        />
        <StatCard
          title="Live Tourists"
          value={totalPresence.toLocaleString()}
          icon={<Users className="w-full h-full" />}
          accent="blue"
          subtitle={`Across ${presence.length} zones`}
          isLoading={false}
          onClick={() => navigate('/analytics')}
        />
        <StatCard
          title="High Risk Zones"
          value={highRiskZones}
          icon={<MapPin className="w-full h-full" />}
          accent={highRiskZones > 0 ? 'orange' : 'emerald'}
          subtitle={`${zones.length} total zones monitored`}
          isLoading={zoneLoading}
          onClick={() => navigate('/zones')}
        />
        <StatCard
          title="Active Devices"
          value={activeDevices}
          icon={<Cpu className="w-full h-full" />}
          accent="cyan"
          subtitle={`${devices.length} total registered`}
          isLoading={devLoading}
          onClick={() => navigate('/devices')}
        />
      </StatGrid>

      {/* Health alert banner */}
      {!alertLoading && alerts.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 animate-pulse">
            <HeartPulse className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {alerts.length} Active Health Alert{alerts.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Immediate medical attention may be required
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => navigate('/health')}
          >
            View Alerts
          </Button>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident trend — takes 2 cols */}
        <Card className="lg:col-span-2">
          <CardBody>
            <SectionHeader
              title="Incident Trend (30 days)"
              subtitle="Daily incident volume over the past month"
              size="sm"
            />
            <IncidentTrendChart
              data={trend}
              isLoading={analyticsLoading}
              height={240}
            />
          </CardBody>
        </Card>

        {/* Zone risk distribution */}
        <Card>
          <CardBody>
            <SectionHeader
              title="Zone Risk Distribution"
              subtitle="Current risk breakdown"
              size="sm"
            />
            <ZoneRiskChart
              data={zoneRisk}
              isLoading={analyticsLoading}
              height={240}
            />
          </CardBody>
        </Card>
      </div>

      {/* Bottom row: recent incidents + incident status + crowd density */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent incidents table */}
        <Card className="xl:col-span-2">
          <CardBody>
            <SectionHeader
              title="Recent Incidents"
              subtitle="Latest 8 reported incidents"
              size="sm"
              action={
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate('/incidents')}
                >
                  View all →
                </Button>
              }
            />
            <IncidentTable
              incidents={recentIncidents}
              isLoading={incLoading}
              onRowClick={(inc) => navigate(`/incidents/${inc.id}`)}
              zoneNames={Object.fromEntries(
                zonesWithStatus.map((z) => [z.id, z.name])
              )}
            />
          </CardBody>
        </Card>

        {/* Right column: status chart + crowd density */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <SectionHeader
                title="Incident Status"
                subtitle="Current status breakdown"
                size="sm"
              />
              <IncidentStatusChart
                data={status}
                isLoading={analyticsLoading}
                height={180}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader
                title="Live Crowd Density"
                subtitle="Tourists per zone"
                size="sm"
              />
              <CrowdDensityChart
                data={presence}
                isLoading={false}
                height={160}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Zones overview */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Zone Overview"
            subtitle="All monitored zones with current risk status"
            size="sm"
            action={
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/zones')}
              >
                Manage zones →
              </Button>
            }
          />
          <ZoneTable
            zones={zonesWithStatus}
            isLoading={zoneLoading}
            onRowClick={() => navigate('/zones')}
          />
        </CardBody>
      </Card>
    </div>
  );
}
