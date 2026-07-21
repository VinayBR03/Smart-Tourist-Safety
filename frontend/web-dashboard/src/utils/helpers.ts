// ─────────────────────────────────────────────
// Online status helper
// A user is considered online if their last_activity
// was within the past 5 minutes.
// ─────────────────────────────────────────────

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function isOnline(lastActivity: string | null | undefined): boolean {
  if (!lastActivity) return false;
  return Date.now() - new Date(lastActivity).getTime() < ONLINE_THRESHOLD_MS;
}