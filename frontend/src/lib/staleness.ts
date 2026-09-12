// Shared "no movement in N+ days" definition for list staleness indicators
// (Jobs overview, Companies overview, and any future list that wants one) —
// each surface computes it from its own record's own `updatedAt`, but they
// all agree on what "stale" means so the highlighting reads consistently
// across the app.
export const STALE_DAYS = 14;

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
