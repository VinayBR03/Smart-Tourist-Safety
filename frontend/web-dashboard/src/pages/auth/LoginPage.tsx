// src/pages/auth/LoginPage.tsx

import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LoginFormState {
  email:    string;
  password: string;
}

// ─────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────

export function LoginPage() {
  const navigate                  = useNavigate();
  const location                  = useLocation();
  const { login, isLoading }      = useAuth();
  const [form, setForm]           = useState<LoginFormState>({ email: '', password: '' });
  const [error, setError]         = useState<string | null>(null);

  const from = (location.state as { from?: string })?.from ?? '/';

  const handleChange = useCallback(
    (field: keyof LoginFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        if (error) setError(null);
      },
    [error]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.email.trim() || !form.password) {
        setError('Please enter both email and password.');
        return;
      }

      try {
        await login({ email: form.email.trim(), password: form.password });
        navigate(from, { replace: true });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Invalid credentials. Please try again.';
        setError(msg);
      }
    },
    [form, login, navigate, from]
  );

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Sentinel Tour
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Operations Control Dashboard
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="admin@sentineltour.gov.in"
            value={form.email}
            onChange={handleChange('email')}
            autoComplete="email"
            autoFocus
            leftIcon={<Mail className="w-4 h-4" />}
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange('password')}
            autoComplete="current-password"
            leftIcon={<Lock className="w-4 h-4" />}
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
          >
            Sign in to Dashboard
          </Button>
        </form>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Authorised personnel only. All activity is monitored and logged.
        </p>
      </div>

      {/* Brand footer */}
      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-600">
        © {new Date().getFullYear()} Tourist Authority — Sentinel Tour v1.0
      </p>
    </div>
  );
}
