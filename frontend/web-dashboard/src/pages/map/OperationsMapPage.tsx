// src/pages/map/OperationsMapPage.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Map,
  RefreshCw,
  Users,
  MapPin,
  Activity,
  Eye,
  EyeOff,
  AlertTriangle,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

import { useLiveLocations, useZonePresence }  from '../../hooks/useLocations';
import { useZones }                           from '../../hooks/useZones';
import { useIncidents }                       from '../../hooks/useIncidents';
import { useDevices }                         from '../../hooks/useDevices';

import { PageHeader }                         from '../../components/ui/SectionHeader';
import { SectionHeader }                      from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }                 from '../../components/ui/StatCard';
import { Card, CardBody }                     from '../../components/ui/Card';
import { Button }                             from '../../components/common/Button';
import { IncidentStatusBadge }               from '../../components/common/Badge';
import { LeafletMap }                         from '../../components/maps/LeafletMap';
import { TouristMarkerLayer }                 from '../../components/maps/TouristMarkerLayer';
import { ZoneOverlay }                        from '../../components/maps/ZoneOverlay';
import type { ZoneGeometry }                  from '../../components/maps/ZoneOverlay';
import { MapLegend }                          from '../../components/ui/MapLegend';
import { EmptyState }                         from '../../components/common/EmptyState';

import { IncidentStatus, RiskLevel, DeviceType, DeviceStatus } from '../../types/enums';
import type { ZoneWithStatus }                from '../../types/zone';
import type { LocationResponse }              from '../../types/location';
import { formatTimeAgo }                      from '../../utils/formatDate';
import { useMapCenter }                       from '../../hooks/useMapCenter';

// ─────────────────────────────────────────────
// Helpers: extract geometry from zone data
// ─────────────────────────────────────────────

function getZoneGeometry(zone: ZoneWithStatus): ZoneGeometry | null {
  // Circular zone
  if (
    zone.center_latitude  != null &&
    zone.center_longitude != null &&
    zone.radius_meters    != null
  ) {
    return {
      type:             'circular',
      center_latitude:  zone.center_latitude,
      center_longitude: zone.center_longitude,
      radius_meters:    zone.radius_meters,
    };
  }
  // Polygon zone
  if (zone.coordinates && zone.coordinates.length >= 3) {
    return {
      type:        'polygon',
      coordinates: zone.coordinates,
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// Selected tourist info panel
// ─────────────────────────────────────────────

function TouristInfoPanel({
  loc,
  onClose,
}: {
  loc:     LocationResponse;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] w-72">
      <Card variant="elevated">
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {loc.tourist_id % 100}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tourist {loc.tourist_id}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Latitude</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {loc.latitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Longitude</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {loc.longitude.toFixed(6)}
              </span>
            </div>
            {loc.accuracy_meters != null && (
              <div className="flex justify-between">
                <span className="text-slate-500">Accuracy</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  ±{loc.accuracy_meters.toFixed(0)}m
                </span>
              </div>
            )}
            {loc.battery_percentage != null && (
              <div className="flex justify-between">
                <span className="text-slate-500">Battery</span>
                <span className={[
                  'font-mono font-semibold',
                  loc.battery_percentage < 20
                    ? 'text-red-500'
                    : loc.battery_percentage < 50
                    ? 'text-amber-500'
                    : 'text-emerald-500',
                ].join(' ')}>
                  {loc.battery_percentage.toFixed(0)}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Last seen</span>
              <span className="text-slate-700 dark:text-slate-300">
                {formatTimeAgo(loc.updated_at)}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Device type icon
// ─────────────────────────────────────────────

function deviceTypeLabel(type: DeviceType): string {
  switch (type) {
    case DeviceType.NODE:      return '📡 Node';
    case DeviceType.GATEWAY:   return '🔗 Gateway';
    case DeviceType.WRISTBAND: return '⌚ Wristband';
    default: return type;
  }
}

// ─────────────────────────────────────────────
// OperationsMapPage
// ─────────────────────────────────────────────

export function OperationsMapPage() {
  const { activeLocations, isLoading: locLoading, refetch: refetchLoc, lastFetch } =
    useLiveLocations();
  const { presence }                       = useZonePresence();
  const { zones, isLoading: zoneLoading }  = useZones();
  const { incidents }                      = useIncidents();
  const { devices }                        = useDevices();

  const { center, zoom, isLocating, source, persist } = useMapCenter();

  const [showTourists,  setShowTourists]  = useState(true);
  const [showZones,     setShowZones]     = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [selectedLoc,   setSelectedLoc]   = useState<LocationResponse | null>(null);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const fullscreenRef                     = useRef<HTMLDivElement>(null);

  const allZones = useMemo(() => zones as ZoneWithStatus[], [zones]);

  // ── Active incidents ──
  const activeIncidents = useMemo(
    () =>
      incidents.filter((i) =>
        i.status === IncidentStatus.OPEN ||
        i.status === IncidentStatus.IN_PROGRESS ||
        i.status === IncidentStatus.ESCALATED
      ),
    [incidents]
  );

  // ── Infrastructure devices ──
  const infraDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          (d.device_type === DeviceType.NODE || d.device_type === DeviceType.GATEWAY) &&
          d.status === DeviceStatus.ACTIVE
      ),
    [devices]
  );

  // ── Stats ──
  const stats = useMemo(() => ({
    tourists:  activeLocations.length,
    zones:     allZones.filter((z) => z.is_active).length,
    highRisk:  allZones.filter((z) => z.risk_level === RiskLevel.HIGH).length,
    incidents: activeIncidents.length,
  }), [activeLocations, allZones, activeIncidents]);

  // ── Legend config ──
  const legendSections = [
    {
      title: 'Tourists',
      items: [
        { color: '#3b82f6', label: 'Active',         shape: 'circle' as const },
        { color: '#94a3b8', label: 'Stale (>5 min)', shape: 'circle' as const, opacity: 0.4 },
      ],
    },
    {
      title: 'Risk Zones',
      items: [
        { color: '#22c55e', label: 'Low Risk',    shape: 'square' as const },
        { color: '#f97316', label: 'Medium Risk', shape: 'square' as const },
        { color: '#ef4444', label: 'High Risk',   shape: 'square' as const },
      ],
    },
    {
      title: 'Incidents',
      items: [
        { color: '#f59e0b', label: 'Open',        shape: 'circle' as const },
        { color: '#ef4444', label: 'Escalated',   shape: 'circle' as const },
        { color: '#3b82f6', label: 'In Progress', shape: 'circle' as const },
      ],
    },
  ];

  // ── Fullscreen: ESC key handler ──
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // ── Fullscreen: lock body scroll ──
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  const handleRefresh    = useCallback(() => { refetchLoc(); }, [refetchLoc]);
  const handleMarkerClick = useCallback((loc: LocationResponse) => {
    setSelectedLoc((prev) => (prev?.tourist_id === loc.tourist_id ? null : loc));
  }, []);

  // ── Map height ──
  const mapHeight = isFullscreen ? 'calc(100vh - 96px)' : 520;

  // ── Map panel ──
  const mapPanel = (
    <div className="relative">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
        <div className="flex items-center gap-2">
          <SectionHeader title="Live Map" size="sm" />
          {isLocating && (
            <span className="text-[11px] text-slate-400 animate-pulse">Locating…</span>
          )}
          {!isLocating && source === 'geo' && (
            <span className="text-[11px] text-emerald-500">📍 Your location</span>
          )}
          {!isLocating && source === 'stored' && (
            <span className="text-[11px] text-slate-400">Last position</span>
          )}
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <Button
            variant={showTourists ? 'primary' : 'outline'}
            size="xs"
            leftIcon={showTourists ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            onClick={() => setShowTourists((v) => !v)}
          >
            Tourists
          </Button>
          <Button
            variant={showZones ? 'primary' : 'outline'}
            size="xs"
            leftIcon={<MapPin className="w-3.5 h-3.5" />}
            onClick={() => setShowZones((v) => !v)}
          >
            Zones
          </Button>
          <Button
            variant={showIncidents ? 'primary' : 'outline'}
            size="xs"
            leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
            onClick={() => setShowIncidents((v) => !v)}
          >
            Incidents
          </Button>
          <Button
            variant="outline"
            size="xs"
            leftIcon={isFullscreen
              ? <Minimize2 className="w-3.5 h-3.5" />
              : <Maximize2 className="w-3.5 h-3.5" />
            }
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen mode'}
          >
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <LeafletMap height={mapHeight} center={center} zoom={zoom} onMoveEnd={persist}>

          {/* Zone overlays — rendered like mobile app */}
          {showZones && allZones
            .filter((z) => z.is_active)
            .map((zone) => {
              const geom = getZoneGeometry(zone);
              if (!geom) return null;
              return (
                <ZoneOverlay
                  key={zone.id}
                  zone={zone}
                  geometry={geom}
                />
              );
            })}

          {/* Tourist markers */}
          {showTourists && (
            <TouristMarkerLayer
              locations={activeLocations}
              onMarkerClick={handleMarkerClick}
            />
          )}
        </LeafletMap>

        {/* Legend overlay */}
        <div className="absolute bottom-10 right-3 z-[1000]">
          <MapLegend
            sections={legendSections}
            position="bottom-right"
            collapsible
            title="Map Legend"
          />
        </div>

        {/* Selected tourist panel */}
        {selectedLoc && (
          <TouristInfoPanel
            loc={selectedLoc}
            onClose={() => setSelectedLoc(null)}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Operations Map"
        subtitle="Live view of tourist locations and zone risk across the pilgrimage area"
        icon={<Map className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Operations Map' }]}
        action={
          <div className="flex items-center gap-2">
            {lastFetch && (
              <span className="text-xs text-slate-400">
                Updated {formatTimeAgo(lastFetch.toISOString())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
              loading={locLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Live Tourists"
          value={stats.tourists}
          icon={<Users className="w-full h-full" />}
          accent="blue"
          subtitle="Active within 5 min"
          isLoading={locLoading}
        />
        <StatCard
          title="Active Zones"
          value={stats.zones}
          icon={<MapPin className="w-full h-full" />}
          accent="cyan"
          isLoading={zoneLoading}
        />
        <StatCard
          title="High Risk Zones"
          value={stats.highRisk}
          icon={<Activity className="w-full h-full" />}
          accent={stats.highRisk > 0 ? 'red' : 'emerald'}
          isLoading={zoneLoading}
        />
        <StatCard
          title="Active Incidents"
          value={stats.incidents}
          icon={<AlertTriangle className="w-full h-full" />}
          accent={stats.incidents > 0 ? 'orange' : 'slate'}
          isLoading={false}
        />
      </StatGrid>

      {/* ── FULLSCREEN OVERLAY ── */}
      {isFullscreen && (
        <div
          ref={fullscreenRef}
          className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Map className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Operations Map — Fullscreen
              </span>
              {lastFetch && (
                <span className="text-xs text-slate-400">
                  Updated {formatTimeAgo(lastFetch.toISOString())}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-4 mr-4 text-xs text-slate-500">
                <span>
                  <span className="font-semibold text-blue-600">{stats.tourists}</span> tourists
                </span>
                <span>
                  <span className={`font-semibold ${stats.incidents > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {stats.incidents}
                  </span> incidents
                </span>
                <span>
                  <span className={`font-semibold ${stats.highRisk > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                    {stats.highRisk}
                  </span> high risk zones
                </span>
              </div>
              <Button
                variant="outline"
                size="xs"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleRefresh}
                loading={locLoading}
              >
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="xs"
                leftIcon={<Minimize2 className="w-3.5 h-3.5" />}
                onClick={() => setIsFullscreen(false)}
              >
                Exit (Esc)
              </Button>
            </div>
          </div>

          <div className="flex-1 p-2 overflow-hidden">
            {mapPanel}
          </div>
        </div>
      )}

      {/* ── NORMAL LAYOUT ── */}
      {!isFullscreen && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Map */}
          <div className="xl:col-span-3">
            <Card>
              <CardBody className="p-2">
                {mapPanel}
              </CardBody>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Zone presence */}
            <Card>
              <CardBody>
                <SectionHeader
                  title="Zone Presence"
                  subtitle="Tourists per zone"
                  size="sm"
                  divider
                />
                {presence.length === 0 ? (
                  <EmptyState
                    title="No presence data"
                    message="Live zone data unavailable."
                    compact
                  />
                ) : (
                  <div className="space-y-2">
                    {[...presence]
                      .sort((a, b) => b.tourist_count - a.tourist_count)
                      .slice(0, 8)
                      .map((p) => {
                        const zone = allZones.find((z) => z.id === p.zone_id);
                        const riskColor =
                          zone?.risk_level === RiskLevel.HIGH   ? 'bg-red-500'
                          : zone?.risk_level === RiskLevel.MEDIUM ? 'bg-orange-400'
                          : 'bg-blue-500';
                        return (
                          <div key={p.zone_id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                {zone?.name ?? `Zone ${p.zone_id}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${riskColor}`}
                                  style={{
                                    width: `${Math.min(100, (p.tourist_count / Math.max(...presence.map((x) => x.tourist_count), 1)) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-6 text-right">
                                {p.tourist_count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Active incidents */}
            <Card>
              <CardBody>
                <SectionHeader
                  title="Active Incidents"
                  subtitle={`${stats.incidents} open / in-progress / escalated`}
                  size="sm"
                  divider
                />
                {activeIncidents.length === 0 ? (
                  <EmptyState
                    title="No active incidents"
                    message="All incidents resolved."
                    compact
                  />
                ) : (
                  <div className="space-y-2">
                    {activeIncidents.slice(0, 6).map((inc) => {
                      const zone = allZones.find((z) => z.id === inc.zone_id);
                      return (
                        <div key={inc.id} className="flex items-start justify-between gap-2 py-1">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {inc.id}
                              {zone && (
                                <span className="ml-1 font-normal text-slate-400">
                                  · {zone.name}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatTimeAgo(inc.created_at)}
                            </p>
                          </div>
                          <IncidentStatusBadge status={inc.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Infrastructure devices */}
            <Card>
              <CardBody>
                <SectionHeader
                  title="Infrastructure"
                  subtitle="Active nodes & gateways"
                  size="sm"
                  divider
                />
                {infraDevices.length === 0 ? (
                  <EmptyState
                    title="No active infrastructure"
                    message="No NODE or GATEWAY devices active."
                    compact
                  />
                ) : (
                  <div className="space-y-2">
                    {infraDevices.slice(0, 6).map((d) => (
                      <div key={d.device_id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {deviceTypeLabel(d.device_type)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {d.device_id}
                          </p>
                        </div>
                        {d.battery_percentage != null && (
                          <span className={[
                            'text-[11px] font-semibold flex-shrink-0',
                            d.battery_percentage < 20 ? 'text-red-500'
                            : d.battery_percentage < 50 ? 'text-amber-500'
                            : 'text-emerald-500',
                          ].join(' ')}>
                            {d.battery_percentage.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    ))}
                    {infraDevices.length > 6 && (
                      <p className="text-[11px] text-slate-400 text-center pt-1">
                        +{infraDevices.length - 6} more devices
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}