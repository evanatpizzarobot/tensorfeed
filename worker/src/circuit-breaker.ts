/**
 * Per-token circuit breaker for premium endpoints.
 *
 * Detects "infinite loop" patterns where a misbehaving agent fires the
 * exact same authenticated request on a tight loop and burns through
 * credits. The breaker trips when one bearer token issues more than
 * THRESHOLD identical requests inside WINDOW_MS, returning HTTP 429
 * with a cooldown hint and refusing to charge credits.
 *
 * Identical = same path + sorted query string. Body is excluded
 * because every premium endpoint is GET; if a future POST endpoint
 * needs body-aware fingerprinting, hash it into the key.
 *
 * State lives in an isolate-local Map. Cloudflare typically pins a
 * given client to the same isolate, so repeated requests from one
 * agent will hit the same counter. A loop that gets distributed
 * across isolates (rare in practice for steady traffic from one
 * source) will leak through, but the worst-case still gives the
 * agent a soft slowdown rather than the hard stop a single isolate
 * would enforce. We accept this tradeoff to avoid burning KV budget
 * on a defense-in-depth check.
 *
 * To keep the Map bounded, we GC entries whose timestamps have all
 * fallen out of the window when the Map grows past MAX_TRACKED_KEYS.
 */

const WINDOW_MS = 60_000;
const THRESHOLD = 20; // 21st identical request in 60s trips the breaker
const COOLDOWN_SECONDS = 120;
const MAX_TRACKED_KEYS = 5000;

interface BreakerState {
  // Sliding window of request timestamps for this key. Old entries are
  // evicted on every check.
  timestamps: number[];
  // Once tripped, refuse all matching requests until this timestamp.
  cooldownUntil?: number;
}

const tracker = new Map<string, BreakerState>();

export interface CircuitBreakerCheck {
  tripped: boolean;
  count: number;
  cooldown_seconds?: number;
  retry_after_unix_ms?: number;
}

/**
 * Check whether the (token, path, query) tuple has tripped the
 * breaker. Always records the current call so subsequent identical
 * calls accumulate; trips fire on the request that crosses the
 * threshold.
 *
 * `tokenShort` is a non-secret prefix used purely as the lookup key
 * so we never persist the full bearer token in memory. The caller
 * should pass `token.slice(0, 16)` or similar.
 */
export function checkCircuitBreaker(
  tokenShort: string,
  path: string,
  query: string,
  now: number = Date.now(),
): CircuitBreakerCheck {
  const key = `${tokenShort}|${path}|${query}`;
  const existing = tracker.get(key);

  // Honor an active cooldown without recording new traffic; the
  // misbehaving agent has already been told to back off.
  if (existing?.cooldownUntil && existing.cooldownUntil > now) {
    return {
      tripped: true,
      count: existing.timestamps.length,
      cooldown_seconds: Math.ceil((existing.cooldownUntil - now) / 1000),
      retry_after_unix_ms: existing.cooldownUntil,
    };
  }

  const windowStart = now - WINDOW_MS;
  const recent = (existing?.timestamps ?? []).filter((t) => t >= windowStart);
  recent.push(now);

  if (recent.length > THRESHOLD) {
    const cooldownUntil = now + COOLDOWN_SECONDS * 1000;
    tracker.set(key, { timestamps: recent, cooldownUntil });
    maybeGarbageCollect(now);
    return {
      tripped: true,
      count: recent.length,
      cooldown_seconds: COOLDOWN_SECONDS,
      retry_after_unix_ms: cooldownUntil,
    };
  }

  tracker.set(key, { timestamps: recent });
  maybeGarbageCollect(now);
  return { tripped: false, count: recent.length };
}

function maybeGarbageCollect(now: number): void {
  if (tracker.size <= MAX_TRACKED_KEYS) return;
  const windowStart = now - WINDOW_MS;
  for (const [k, v] of tracker) {
    const stillCoolingDown = v.cooldownUntil && v.cooldownUntil > now;
    const hasRecent = v.timestamps.some((t) => t >= windowStart);
    if (!stillCoolingDown && !hasRecent) {
      tracker.delete(k);
    }
  }
}

export function _resetCircuitBreakerForTests(): void {
  tracker.clear();
}

export const CIRCUIT_BREAKER_LIMITS = {
  WINDOW_MS,
  THRESHOLD,
  COOLDOWN_SECONDS,
  MAX_TRACKED_KEYS,
};
