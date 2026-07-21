// src/pages/admin/AuthoritiesPage.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Mail,
  Calendar,
} from 'lucide-react';

import { listUsers, createAuthority, updateUserStatus } from '../../api/userApi';

import { PageHeader }               from '../../components/ui/SectionHeader';
import { SectionHeader }            from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }       from '../../components/ui/StatCard';
import { Card, CardBody }           from '../../components/ui/Card';
import { Button }                   from '../../components/common/Button';
import { Input }                    from '../../components/common/Input';
import { ConfirmModal }             from '../../components/common/Modal';
import { CreateAuthorityModal }     from '../../components/admin/CreateAuthorityModal';
import { Badge }                    from '../../components/common/Badge';
import { EmptyState }               from '../../components/common/EmptyState';
import { SkeletonListItem }         from '../../components/common/Skeleton';

import { UserRole }                 from '../../types/enums';
import type { UserAdminResponse, CreateAuthorityRequest } from '../../types/user';
import { formatDate, formatTimeAgo } from '../../utils/formatDate';

// ─────────────────────────────────────────────
// Authority card
// ─────────────────────────────────────────────

function AuthorityCard({
  user,
  currentUserId,
  onToggle,
  isToggling,
}: {
  user:         UserAdminResponse;
  currentUserId?: number;
  onToggle:     (user: UserAdminResponse) => void;
  isToggling:   boolean;
}) {
  const isSelf = user.id === currentUserId;

  return (
    <div className={[
      'p-4 rounded-xl border transition-all',
      user.is_active
        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-70',
    ].join(' ')}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className={[
            'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
            user.is_active
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
          ].join(' ')}>
            {(user.full_name ?? user.email)[0].toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
              {user.full_name ?? '—'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-slate-400" />
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          {user.is_active ? (
            <Badge variant="success" size="sm" dot>Active</Badge>
          ) : (
            <Badge variant="ghost" size="sm" dot>Inactive</Badge>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Joined {formatDate(user.created_at)}
        </div>
        {user.last_login && (
          <div className="flex items-center gap-1">
            Last login {formatTimeAgo(user.last_login)}
          </div>
        )}
        {!user.is_verified && (
          <Badge variant="warning" size="sm">Unverified</Badge>
        )}
      </div>

      {/* Actions */}
      {!isSelf && (
        <Button
          variant={user.is_active ? 'ghost' : 'success'}
          size="xs"
          fullWidth
          loading={isToggling}
          onClick={() => onToggle(user)}
          leftIcon={
            user.is_active
              ? <UserX className="w-3.5 h-3.5" />
              : <UserCheck className="w-3.5 h-3.5" />
          }
        >
          {user.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      )}
      {isSelf && (
        <p className="text-xs text-center text-slate-400 italic">Your account</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AuthoritiesPage
// ─────────────────────────────────────────────

export function AuthoritiesPage() {
  const [authorities,  setAuthorities]  = useState<UserAdminResponse[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);
  const [confirmTarget,setConfirmTarget]= useState<UserAdminResponse | null>(null);
  const [isToggling,   setIsToggling]   = useState(false);
  const [togglingId,   setTogglingId]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const all = await listUsers();
      setAuthorities(all.filter((u) => u.role === UserRole.AUTHORITY));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load authorities.');
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

  // ── Stats ──
  const stats = useMemo(() => ({
    total:     authorities.length,
    active:    authorities.filter((a) => a.is_active).length,
    inactive:  authorities.filter((a) => !a.is_active).length,
    unverified:authorities.filter((a) => !a.is_verified).length,
  }), [authorities]);

  // ── Filtered ──
  const filtered = useMemo(() => {
    if (!search.trim()) return authorities;
    const q = search.toLowerCase();
    return authorities.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q)
    );
  }, [authorities, search]);

  // ── Create handler ──
  const handleCreate = useCallback(
    async (payload: CreateAuthorityRequest) => {
      setIsCreating(true);
      try {
        const newUser = await createAuthority(payload);
        setAuthorities((prev) => [newUser, ...prev]);
        setShowCreate(false);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  // ── Toggle handler ──
  const handleToggle = useCallback((user: UserAdminResponse) => {
    setConfirmTarget(user);
  }, []);

  const confirmToggle = useCallback(async () => {
    if (!confirmTarget) return;
    setIsToggling(true);
    setTogglingId(confirmTarget.id);
    try {
      await updateUserStatus(confirmTarget.id, !confirmTarget.is_active);
      setAuthorities((prev) =>
        prev.map((a) =>
          a.id === confirmTarget.id ? { ...a, is_active: !a.is_active } : a
        )
      );
      setConfirmTarget(null);
    } finally {
      setIsToggling(false);
      setTogglingId(null);
    }
  }, [confirmTarget]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Authority Management"
        subtitle="Manage authority users who have operational access to the CrowdGuard system"
        icon={<Shield className="w-5 h-5" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Admin' },
          { label: 'Authorities' },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={load}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreate(true)}
            >
              Add Authority
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Total Authorities"
          value={stats.total}
          icon={<Shield className="w-full h-full" />}
          accent="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={<UserCheck className="w-full h-full" />}
          accent="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={<UserX className="w-full h-full" />}
          accent={stats.inactive > 0 ? 'orange' : 'slate'}
          isLoading={isLoading}
        />
        <StatCard
          title="Unverified"
          value={stats.unverified}
          icon={<Shield className="w-full h-full" />}
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
              title="Authority Users"
              subtitle={`${filtered.length} of ${authorities.length} authorities`}
              size="sm"
            />
            <Input
              placeholder="Search authorities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputSize="sm"
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth={false}
              className="w-52"
            />
          </div>

          {/* Content */}
          {error ? (
            <EmptyState
              icon={<Shield className="w-8 h-8 text-red-500" />}
              title="Failed to load authorities"
              message={error}
              action={{ label: 'Retry', onClick: load }}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonListItem key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Shield className="w-8 h-8 text-slate-400" />}
              title="No authorities found"
              message={
                search.trim()
                  ? 'No authorities match your search.'
                  : 'Add your first authority user to get started.'
              }
              action={!search.trim() ? { label: 'Add Authority', onClick: () => setShowCreate(true) } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((auth) => (
                <AuthorityCard
                  key={auth.id}
                  user={auth}
                  onToggle={handleToggle}
                  isToggling={togglingId === auth.id && isToggling}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create modal */}
      <CreateAuthorityModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      {/* Toggle confirm modal */}
      {confirmTarget && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmTarget(null)}
          onConfirm={confirmToggle}
          title={confirmTarget.is_active ? 'Deactivate Authority' : 'Activate Authority'}
          message={`Are you sure you want to ${confirmTarget.is_active ? 'deactivate' : 'activate'} ${confirmTarget.full_name ?? confirmTarget.email}?`}
          confirmText={confirmTarget.is_active ? 'Deactivate' : 'Activate'}
          variant={confirmTarget.is_active ? 'danger' : 'success'}
          loading={isToggling}
        />
      )}
    </div>
  );
}
