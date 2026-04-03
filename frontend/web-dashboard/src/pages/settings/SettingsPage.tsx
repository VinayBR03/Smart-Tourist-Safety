// src/pages/settings/SettingsPage.tsx

import { useState, useCallback } from 'react';
import {
  Settings,
  Lock,
  User,
  Mail,
  Shield,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import { useAuth }          from '../../hooks/useAuth';
import { changePassword }   from '../../api/authApi';
import type { ChangePasswordRequest } from '../../api/authApi';

import { PageHeader }       from '../../components/ui/SectionHeader';
import { SectionHeader }    from '../../components/ui/SectionHeader';
import { Card, CardBody }   from '../../components/ui/Card';
import { Button }           from '../../components/common/Button';
import { Input }            from '../../components/common/Input';
import { Badge }            from '../../components/common/Badge';

import { UserRole }         from '../../types/enums';
import { formatDateTime }   from '../../utils/formatDate';

// ─────────────────────────────────────────────
// Role badge helper
// ─────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, { label: string; variant: 'danger' | 'warning' | 'info' }> = {
    [UserRole.ADMIN]:     { label: 'Administrator', variant: 'danger' },
    [UserRole.AUTHORITY]: { label: 'Authority',     variant: 'warning' },
    [UserRole.TOURIST]:   { label: 'Tourist',       variant: 'info' },
  };
  const { label, variant } = map[role];
  return <Badge variant={variant} dot>{label}</Badge>;
}

// ─────────────────────────────────────────────
// Profile info row
// ─────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon:  React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
          {value}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────

export function SettingsPage() {
  const { user, logout } = useAuth();

  // ── Change password form state ──
  const [form, setForm] = useState<ChangePasswordRequest>({
    current_password:  '',
    new_password:      '',
    confirm_password:  '',
  });
  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleChange = useCallback(
    (field: keyof ChangePasswordRequest) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (error) setError(null);
        if (success) setSuccess(false);
      },
    [error, success]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.current_password || !form.new_password || !form.confirm_password) {
        setError('All fields are required.');
        return;
      }

      if (form.new_password !== form.confirm_password) {
        setError('New passwords do not match.');
        return;
      }

      if (form.new_password.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }

      if (form.new_password === form.current_password) {
        setError('New password must differ from current password.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await changePassword(form);
        setSuccess(true);
        setForm({ current_password: '', new_password: '', confirm_password: '' });

        // After password change the token version is bumped server-side.
        // Force logout so user re-authenticates with new credentials.
        setTimeout(() => {
          logout();window.location.replace('/login');
        }, 2500);

      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to change password. Please try again.'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, logout]
  );

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <PageHeader
        title="Account Settings"
        subtitle="Manage your profile and security preferences"
        icon={<Settings className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]}
      />

      {/* Profile card */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Profile Information"
            icon={<User className="w-5 h-5" />}
            size="sm"
            divider
          />

          <div className="space-y-0">
            <InfoRow
              icon={<Mail className="w-4 h-4" />}
              label="Email Address"
              value={user.email}
            />
            <InfoRow
              icon={<User className="w-4 h-4" />}
              label="Full Name"
              value={user.full_name ?? '—'}
            />
            <InfoRow
              icon={<Shield className="w-4 h-4" />}
              label="Role"
              value={<RoleBadge role={user.role} />}
            />
            <InfoRow
              icon={<Calendar className="w-4 h-4" />}
              label="Account Created"
              value={formatDateTime(user.created_at)}
            />
            <InfoRow
              icon={<Clock className="w-4 h-4" />}
              label="Last Updated"
              value={formatDateTime(user.updated_at)}
            />
          </div>
        </CardBody>
      </Card>

      {/* Change password card */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Change Password"
            icon={<Lock className="w-5 h-5" />}
            subtitle="After changing your password you will be signed out automatically"
            size="sm"
            divider
          />

          {/* Success banner */}
          {success && (
            <div className="flex items-center gap-3 mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Password changed successfully. Signing you out…
              </p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-3 mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter current password"
              value={form.current_password}
              onChange={handleChange('current_password')}
              autoComplete="current-password"
              disabled={isSubmitting || success}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showCurrent
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Input
              label="New Password"
              type={showNew ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={form.new_password}
              onChange={handleChange('new_password')}
              autoComplete="new-password"
              disabled={isSubmitting || success}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showNew
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Input
              label="Confirm New Password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={form.confirm_password}
              onChange={handleChange('confirm_password')}
              autoComplete="new-password"
              disabled={isSubmitting || success}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showConfirm
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={success}
                leftIcon={<Lock className="w-4 h-4" />}
              >
                Update Password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}