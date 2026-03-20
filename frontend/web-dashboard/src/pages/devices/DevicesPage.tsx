// src/pages/devices/DevicesPage.tsx

import { useState, useMemo, useCallback } from 'react';
import {
  Cpu,
  Plus,
  Search,
  RefreshCw,
  Key,
  AlertCircle,
} from 'lucide-react';

import { useDevices, useDeviceMutations }   from '../../hooks/useDevices';
import { useAuth }                          from '../../hooks/useAuth';

import { PageHeader }                       from '../../components/ui/SectionHeader';
import { SectionHeader }                    from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }               from '../../components/ui/StatCard';
import { Card, CardBody }                   from '../../components/ui/Card';
import { Button }                           from '../../components/common/Button';
import { Input }                            from '../../components/common/Input';
import { Modal }                            from '../../components/common/Modal';
import { DeviceTable }                      from '../../components/devices/DeviceTable';
import { DeviceCard }                       from '../../components/devices/DeviceCard';
import { DeviceForm }                       from '../../components/devices/DeviceForm';

import { DeviceStatus, DeviceType }         from '../../types/enums';
import type { DeviceRegisterResponse } from '../../types/device';

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

type StatusFilter = 'all' | DeviceStatus;
type TypeFilter   = 'all' | DeviceType;
type ViewMode     = 'table' | 'cards';

// ─────────────────────────────────────────────
// API Key reveal modal
// ─────────────────────────────────────────────

function ApiKeyModal({
  result,
  onClose,
}: {
  result: DeviceRegisterResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.api_key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Device Registered Successfully"
      size="md"
      closable={false}
      footer={
        <Button variant="primary" fullWidth onClick={onClose}>
          I've saved the API key — Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This API key is shown only once. Copy and store it securely before closing.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
            Device ID
          </p>
          <code className="block text-sm font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg">
            {result.device_id}
          </code>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
            API Key
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg break-all">
              {result.api_key}
            </code>
            <Button
              variant={copied ? 'success' : 'secondary'}
              size="sm"
              onClick={handleCopy}
              leftIcon={<Key className="w-4 h-4" />}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// DevicesPage
// ─────────────────────────────────────────────

export function DevicesPage() {
  const { isAdmin }   = useAuth();

  const { devices, isLoading, error, refetch }   = useDevices();
  const mutations                                = useDeviceMutations(refetch);

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>('all');
  const [viewMode,      setViewMode]      = useState<ViewMode>('table');
  const [showRegister,  setShowRegister]  = useState(false);
  const [apiKeyResult,  setApiKeyResult]  = useState<DeviceRegisterResponse | null>(null);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:       devices.length,
    active:      devices.filter((d) => d.status === DeviceStatus.ACTIVE).length,
    inactive:    devices.filter((d) => d.status === DeviceStatus.INACTIVE).length,
    maintenance: devices.filter((d) => d.status === DeviceStatus.MAINTENANCE).length,
    lost:        devices.filter((d) => d.status === DeviceStatus.LOST).length,
    wristbands:  devices.filter((d) => d.device_type === DeviceType.WRISTBAND).length,
    lowBattery:  devices.filter(
      (d) => d.battery_percentage !== null && d.battery_percentage < 20
    ).length,
  }), [devices]);

  // ── Filtered ──
  const filtered = useMemo(() => {
    let list = devices;
    if (statusFilter !== 'all') list = list.filter((d) => d.status === statusFilter);
    if (typeFilter   !== 'all') list = list.filter((d) => d.device_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.device_id.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      // Active first, then by device_id
      if (a.status === DeviceStatus.ACTIVE && b.status !== DeviceStatus.ACTIVE) return -1;
      if (a.status !== DeviceStatus.ACTIVE && b.status === DeviceStatus.ACTIVE) return 1;
      return a.device_id.localeCompare(b.device_id);
    });
  }, [devices, statusFilter, typeFilter, search]);

  // ── Status filter tabs ──
  const statusTabs: Array<{ id: StatusFilter; label: string; badge: number }> = [
    { id: 'all',                    label: 'All',         badge: stats.total },
    { id: DeviceStatus.ACTIVE,      label: 'Active',      badge: stats.active },
    { id: DeviceStatus.INACTIVE,    label: 'Inactive',    badge: stats.inactive },
    { id: DeviceStatus.MAINTENANCE, label: 'Maintenance', badge: stats.maintenance },
    { id: DeviceStatus.LOST,        label: 'Lost',        badge: stats.lost },
  ];

  // ── Register handler ──
  const handleRegister = useCallback(
    async (payload: { device_id: string; device_type: DeviceType }) => {
      const result = await mutations.register(payload);
      if (result) {
        setShowRegister(false);
        setApiKeyResult(result);
      }
    },
    [mutations]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Device Management"
        subtitle="Monitor and manage all IoT devices, wristbands, and nodes"
        icon={<Cpu className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Devices' }]}
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
                onClick={() => setShowRegister(true)}
              >
                Register Device
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Active Devices"
          value={stats.active}
          icon={<Cpu className="w-full h-full" />}
          accent="emerald"
          subtitle={`${stats.total} total registered`}
          isLoading={isLoading}
        />
        <StatCard
          title="Wristbands"
          value={stats.wristbands}
          icon={<Cpu className="w-full h-full" />}
          accent="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="In Maintenance"
          value={stats.maintenance}
          icon={<Cpu className="w-full h-full" />}
          accent={stats.maintenance > 0 ? 'orange' : 'slate'}
          isLoading={isLoading}
        />
        <StatCard
          title="Low Battery (<20%)"
          value={stats.lowBattery}
          icon={<Cpu className="w-full h-full" />}
          accent={stats.lowBattery > 0 ? 'red' : 'slate'}
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Low battery alert */}
      {stats.lowBattery > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>{stats.lowBattery} device{stats.lowBattery !== 1 ? 's' : ''}</strong> have battery below 20%.
            Consider replacing or charging them soon.
          </p>
        </div>
      )}

      {/* Main card */}
      <Card>
        <CardBody>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <SectionHeader
              title="All Devices"
              subtitle={`${filtered.length} of ${devices.length} devices`}
              size="sm"
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                placeholder="Search by device ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputSize="sm"
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth={false}
                className="w-48"
              />

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {Object.values(DeviceType).map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>

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

          {/* Status tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
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

          {/* Device list */}
          {viewMode === 'table' ? (
            <DeviceTable
              devices={filtered}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((device) => (
                <DeviceCard key={device.device_id} device={device} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Register modal */}
      <Modal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        title="Register New Device"
        description="Add a new IoT device to the platform"
        size="sm"
      >
        <DeviceForm
          onSubmit={handleRegister}
          isSubmitting={mutations.isSubmitting}
          onCancel={() => setShowRegister(false)}
        />
        {mutations.error && (
          <p className="mt-3 text-xs text-red-500 dark:text-red-400">{mutations.error}</p>
        )}
      </Modal>

      {/* API Key reveal modal */}
      {apiKeyResult && (
        <ApiKeyModal
          result={apiKeyResult}
          onClose={() => { setApiKeyResult(null); refetch(); }}
        />
      )}
    </div>
  );
}
