import { CONFIG } from "./config";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * In-memory token buckets. Correct for a single process; under multiple
 * App Hosting instances this is approximate (documented limitation).
 * Firestore-backed buckets were rejected for v0.1 latency.
 */
export function checkRate(
  principalId: string,
  kind: "read" | "write" | "roomwrite"
): { ok: boolean; retryAfterSec: number } {
  const limit =
    kind === "read" ? CONFIG.rateReadPerMin : kind === "write" ? CONFIG.rateWritePerMin : CONFIG.rateRoomWritePerMin;
  const key = `${principalId}:${kind}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + 60000 };
    buckets.set(key, b);
  }
  if (b.count >= limit) {
    // Burst allowance: 5 extra, then hard stop.
    if (b.count >= limit + 5) {
      return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
    }
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}
