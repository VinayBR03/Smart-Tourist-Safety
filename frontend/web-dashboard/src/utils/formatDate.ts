// src/utils/formatDate.ts

// ─────────────────────────────────────────────
// Normalise datetime strings from the backend.
//
// Python / PostgreSQL may return:
//   "2026-04-01 14:37:37.334605+05:30"   ← space instead of T, microseconds
//   "2026-04-01T14:37:37.334605+05:30"   ← ISO-8601 standard
//   "2026-04-01"                           ← date-only
//   null / undefined
//
// new Date("2026-04-01 14:37:37+05:30") → Invalid Date in many browsers.
// Fix: replace the first space (between date and time) with "T".
// ─────────────────────────────────────────────

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;

  // Replace space separator with T (ISO-8601 requires T)
  // Only replace the first space that sits between a date and a time component.
  const normalised = iso.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/,
    '$1T$2'
  );

  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimeAgo(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';

  const diff = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDuration(
  startIso: string,
  endIso?: string | null
): string {
  const start = parseDate(startIso);
  if (!start) return '—';
  const end  = endIso ? (parseDate(endIso) ?? new Date()) : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);

  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)}d`;
}