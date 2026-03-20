// src/components/admin/UserTable.tsx

import { Table } from '../common/Table';
import { formatDate } from '../../utils/formatDate';
import { Button } from '../common/Button';
import type { UserAdminResponse } from '../../types/user';
import type { Column } from '../common/Table';
import { UserRole } from '../../types/enums';
import { isOnline } from '@/pages/admin/UsersPage';

interface UserTableProps {
  users:          UserAdminResponse[];
  isLoading?:     boolean;
  error?:         string | null;
  onToggleActive?: (user: UserAdminResponse) => void;
  togglingUserId?: number | null;
  className?:     string;
}

const ROLE_BADGES: Record<UserRole, string> = {
  [UserRole.ADMIN]:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  [UserRole.AUTHORITY]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  [UserRole.TOURIST]:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

function buildColumns(
  onToggleActive?: (u: UserAdminResponse) => void,
  togglingUserId?: number | null,
): Column<UserAdminResponse>[] {
  return [
    {
      key:    'full_name',
      header: 'User',
      render: (u) => (
      <div className="flex items-center gap-2">
        {/* Online indicator dot */}
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${
            isOnline(u.last_activity) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
          title={isOnline(u.last_activity) ? 'Online' : 'Offline'}
        />
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {u.full_name ?? '—'}
          </p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      </div>
    ),
    },
    {
      key:    'role',
      header: 'Role',
      render: (u) => (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGES[u.role]}`}>
          {u.role}
        </span>
      ),
    },
    {
      key:    'is_active',
      header: 'Status',
      render: (u) => (
        <span className={`text-xs font-medium ${u.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
          {u.is_active ? '● Active' : '○ Inactive'}
        </span>
      ),
    },
    {
      key:    'is_verified',
      header: 'Verified',
      render: (u) => (
        <span className={`text-xs ${u.is_verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
          {u.is_verified ? '✓' : '✗'}
        </span>
      ),
    },
    {
      key:    'created_at',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(u.created_at)}
        </span>
      ),
    },
    ...(onToggleActive ? [{
      key:    'actions' as keyof UserAdminResponse,
      header: 'Actions',
      render: (u: UserAdminResponse) => (
        <Button
          variant={u.is_active ? 'ghost' : 'success'}
          size="xs"
          onClick={(e) => { e.stopPropagation(); onToggleActive(u); }}
          loading={togglingUserId === u.id}
          disabled={u.role === UserRole.ADMIN}
        >
          {u.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    }] : []),
  ];
}

export function UserTable({
  users, isLoading, error, onToggleActive, togglingUserId, className,
}: UserTableProps) {
  return (
    <Table<UserAdminResponse>
      columns={buildColumns(onToggleActive, togglingUserId)}
      data={users}
      isLoading={isLoading}
      error={error}
      keyExtractor={(u) => u.id}
      emptyTitle="No users found"
      emptyMessage="No users match the current filter."
      stickyHeader
      className={className}
    />
  );
}