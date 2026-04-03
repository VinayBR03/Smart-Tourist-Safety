// src/components/layout/LoginLayout.tsx

import React from 'react';
import logo from '../../assets/logos/SentinelTour-logo.svg';
import { ThemeSwitcher } from './ThemeSwitcher';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LoginLayoutProps {
  children:   React.ReactNode;
  title?:     string;
  subtitle?:  string;
}

// ─────────────────────────────────────────────
// Feature list
// ─────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title:       'Live Location Tracking',
    description: 'Real-time GPS monitoring of all tourists across zones',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
          1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title:       'Incident Management',
    description: 'Rapid response to safety incidents with full audit trails',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1
          3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    title:       'Health Monitoring',
    description: 'Continuous biometric telemetry from IoT wearable devices',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25
          2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title:       'Analytics & Reporting',
    description: 'Actionable insights from historical and live data streams',
  },
];

// ─────────────────────────────────────────────
// LoginLayout
// ─────────────────────────────────────────────

export function LoginLayout({
  children,
  title    = 'Sentinel Tour Dashboard',
  subtitle = 'Smart Tourist Safety System',
}: LoginLayoutProps) {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">

      {/* ── Left panel (branding) — hidden on mobile ── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[520px] flex-shrink-0 bg-slate-900 dark:bg-slate-950 relative overflow-hidden">

        {/* Background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
              <img 
                src={logo}
                className="w-10 h-10"
                alt="Sentinel Tour Logo" 
              />
            </div>
            <div>
              <p className="text-lg font-bold text-white tracking-tight">{title}</p>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="my-12">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Keep every tourist{' '}
              <span className="text-blue-400">safe</span> and{' '}
              <span className="text-cyan-400">connected</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              A unified operations platform for monitoring, responding to incidents,
              and ensuring tourist well-being in real time.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-5 mb-auto">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-xs text-slate-600 mt-8">
            © {new Date().getFullYear()} Sentinel Tour — Secure, real-time tourist safety operations.
          </p>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:invisible">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm">
            <img 
              src={logo}
              className="w-7 h-7"
              alt="Sentinel Tour Logo" 
            />
          </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Sentinel Tour</span>
          </div>

          <ThemeSwitcher variant="icon" />
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}