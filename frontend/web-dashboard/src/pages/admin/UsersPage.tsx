// src/pages/admin/UsersPage.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Users, Search, RefreshCw, UserX, Shield, Wifi } from 'lucide-react';

import { listUsers, updateUserStatus }  from '../../api/userApi';
import { useAuth }                      from '../../hooks/useAuth';

import { PageHeader }                   from '../../components/ui/SectionHeader';
import { SectionHeader }                from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }           from '../../components/ui/StatCard';
import { Card, CardBody }               from '../../components/ui/Card';
import { Button }                       from '../../components/common/Button';
import { Input }                        from '../../components/common/Input';
import { ConfirmModal }                 from '../../components/common/Modal';
import { UserTable }                    from '../../components/admin/UserTable';
import { EmptyState }                   from '../../components/common/EmptyState';

import { UserRole }                     from '../../types/enums';
import type { UserAdminResponse }       from '../../types/user';
import { isOnline } from '../../utils/helpers';

// ─────────────────────────────────────────────
// Hook: admin user list
// ─────────────────────────────────────────────

function useAdminUsers() {
  const [users,     setUsers]     = useState<UserAdminResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const triggerLoad = async () => {
      await load();
    };
    triggerLoad();
  }, [load]);

  return { users, isLoading, error, refetch: load, setUsers };
}


// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

type RoleFilter   = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'inactive' | 'online';


// ─────────────────────────────────────────────
// UsersPage
// ─────────────────────────────────────────────

export function UsersPage() {
  useAuth(); // page is already protected by AuthGuard with ADMIN role
  const { users, isLoading, error, refetch, setUsers } = useAdminUsers();

  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Toggle confirmation
  const [confirmTarget,  setConfirmTarget]  = useState<UserAdminResponse | null>(null);
  const [isToggling,     setIsToggling]     = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:       users.length,
    active:      users.filter((u) => u.is_active).length,
    online:      users.filter((u) => isOnline(u.last_activity)).length,
    tourists:    users.filter((u) => u.role === UserRole.TOURIST).length,
    authorities: users.filter((u) => u.role === UserRole.AUTHORITY).length,
    admins:      users.filter((u) => u.role === UserRole.ADMIN).length,
    unverified:  users.filter((u) => !u.is_verified).length,
  }), [users]);

  // ── Filtered users ──
  const filtered = useMemo(() => {
    let list = users;

    if (roleFilter !== 'all')        list = list.filter((u) => u.role === roleFilter);
    if (statusFilter === 'active')   list = list.filter((u) => u.is_active);
    if (statusFilter === 'inactive') list = list.filter((u) => !u.is_active);
    if (statusFilter === 'online')   list = list.filter((u) => isOnline(u.last_activity));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      // Online users first, then sort by role
      const aOnline = isOnline(a.last_activity) ? 0 : 1;
      const bOnline = isOnline(b.last_activity) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;

      const order = { [UserRole.ADMIN]: 0, [UserRole.AUTHORITY]: 1, [UserRole.TOURIST]: 2 };
      return (order[a.role] ?? 3) - (order[b.role] ?? 3);
    });
  }, [users, roleFilter, statusFilter, search]);

  // ── Role tabs ──
  const roleTabs: Array<{ id: RoleFilter; label: string; badge: number }> = [
    { id: 'all',              label: 'All',         badge: stats.total },
    { id: UserRole.TOURIST,   label: 'Tourists',    badge: stats.tourists },
    { id: UserRole.AUTHORITY, label: 'Authorities', badge: stats.authorities },
    { id: UserRole.ADMIN,     label: 'Admins',      badge: stats.admins },
  ];

  // ── Toggle active handler ──
  const handleToggleActive = useCallback((user: UserAdminResponse) => {
    if (user.role === UserRole.ADMIN) return; // Can't deactivate admins
    setConfirmTarget(user);
  }, []);

  const confirmToggle = useCallback(async () => {
    if (!confirmTarget) return;
    setIsToggling(true);
    setTogglingUserId(confirmTarget.id);
    try {
      await updateUserStatus(confirmTarget.id, !confirmTarget.is_active);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmTarget.id ? { ...u, is_active: !u.is_active } : u
        )
      );
      setConfirmTarget(null);
    } finally {
      setIsToggling(false);
      setTogglingUserId(null);
    }
  }, [confirmTarget, setUsers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="User Management"
        subtitle="View and manage all platform users including tourists, authorities, and admins"
        icon={<Users className="w-5 h-5" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Admin' },
          { label: 'Users' },
        ]}
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
          title="Total Users"
          value={stats.total}
          icon={<Users className="w-full h-full" />}
          accent="blue"
          subtitle={`${stats.active} active`}
          isLoading={isLoading}
        />
        <StatCard
          title="Online Now"
          value={stats.online}
          icon={<Wifi className="w-full h-full" />}
          accent="emerald"
          subtitle="Active in last 5 min"
          isLoading={isLoading}
        />
        <StatCard
          title="Authorities"
          value={stats.authorities}
          icon={<Shield className="w-full h-full" />}
          accent="orange"
          isLoading={isLoading}
        />
        <StatCard
          title="Unverified"
          value={stats.unverified}
          icon={<UserX className="w-full h-full" />}
          accent={stats.unverified > 0 ? 'red' : 'slate'}
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Main card */}
      <Card>
        <CardBody>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <SectionHeader
              title="All Users"
              subtitle={`${filtered.length} of ${users.length} users${stats.online > 0 ? ` · ${stats.online} online` : ''}`}
              size="sm"
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputSize="sm"
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth={false}
                className="w-52"
              />

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="online">🟢 Online</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Role tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-fit">
            {roleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  roleFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
                <span className={[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  roleFilter === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500',
                ].join(' ')}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          {error ? (
            <EmptyState
              icon={<UserX className="w-8 h-8 text-red-500" />}
              title="Failed to load users"
              message={error}
              action={{ label: 'Retry', onClick: refetch }}
            />
          ) : (
            <UserTable
              users={filtered}
              isLoading={isLoading}
              onToggleActive={handleToggleActive}
              togglingUserId={togglingUserId}
            />
          )}
        </CardBody>
      </Card>

      {/* Toggle confirm modal */}
      {confirmTarget && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmTarget(null)}
          onConfirm={confirmToggle}
          title={confirmTarget.is_active ? 'Deactivate User' : 'Activate User'}
          message={`Are you sure you want to ${confirmTarget.is_active ? 'deactivate' : 'activate'} ${confirmTarget.full_name ?? confirmTarget.email}? ${confirmTarget.is_active ? 'They will lose access to the platform.' : 'They will regain access to the platform.'}`}
          confirmText={confirmTarget.is_active ? 'Deactivate' : 'Activate'}
          variant={confirmTarget.is_active ? 'danger' : 'success'}
          loading={isToggling}
        />
      )}
    </div>
  );
}