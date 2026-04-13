import { Env, Article } from './types';

/**
 * Rolling hourly snapshot system.
 *
 * Each snapshot type is stored as a single KV key whose value is an array
 * of up to 24 entries (one per hour). New entries are prepended; the tail
 * is trimmed. If a cron run ever produces empty or missing live data, the
 * latest good snapshot can be restored into the live key so readers
 * never see an empty response.
 *
 * Writes: 7 snapshot keys * once per hour = 168 writes/day (negligible).
 */

const MAX_SNAPSHOTS = 24;

interface SnapshotEntry<T> {
  timestamp: string;
  data: T;
}

type SnapshotType =
  | 'news'
  | 'status:services'
  | 'status:summary'
  | 'status:incidents'
  | 'models'
  | 'benchmarks'
  | 'podcasts'
  | 'trending-repos';

const SNAPSHOT_KEY_PREFIX = 'snapshot:';

function snapshotKey(type: SnapshotType): string {
  return `${SNAPSHOT_KEY_PREFIX}${type}`;
}

function namespaceFor(env: Env, type: SnapshotType): KVNamespace {
  if (type === 'news') return env.TENSORFEED_NEWS;
  if (type === 'status:services' || type === 'status:summary' || type === 'status:incidents') {
    return env.TENSORFEED_STATUS;
  }
  return env.TENSORFEED_CACHE;
}

function liveKeyFor(type: SnapshotType): string {
  switch (type) {
    case 'news':
      return 'articles';
    case 'status:services':
      return 'services';
    case 'status:summary':
      return 'summary';
    case 'status:incidents':
      return 'incidents';
    case 'models':
      return 'models';
    case 'benchmarks':
      return 'benchmarks';
    case 'podcasts':
      return 'podcasts';
    case 'trending-repos':
      return 'trending-repos';
  }
}

function isGoodLiveValue(type: SnapshotType, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (type === 'news') {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === 'status:services' || type === 'status:summary' || type === 'status:incidents') {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === 'podcasts' || type === 'trending-repos') {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === 'models') {
    const v = value as { providers?: unknown[] };
    return Array.isArray(v.providers) && v.providers.length > 0;
  }
  if (type === 'benchmarks') {
    const v = value as { models?: unknown[] };
    return Array.isArray(v.models) && v.models.length > 0;
  }
  return false;
}

async function readSnapshotArray<T>(env: Env, type: SnapshotType): Promise<SnapshotEntry<T>[]> {
  const ns = namespaceFor(env, type);
  const raw = (await ns.get(snapshotKey(type), 'json')) as SnapshotEntry<T>[] | null;
  return Array.isArray(raw) ? raw : [];
}

async function writeSnapshotArray<T>(
  env: Env,
  type: SnapshotType,
  entries: SnapshotEntry<T>[],
): Promise<void> {
  const ns = namespaceFor(env, type);
  await ns.put(snapshotKey(type), JSON.stringify(entries));
}

/**
 * Capture the current live value for a given type into the rolling snapshot
 * array, if the live value looks healthy. Returns true if a snapshot was
 * taken, false if skipped (missing or empty live data).
 */
export async function captureSnapshot(env: Env, type: SnapshotType): Promise<boolean> {
  const ns = namespaceFor(env, type);
  const live = await ns.get(liveKeyFor(type), 'json');
  if (!isGoodLiveValue(type, live)) {
    console.warn(`snapshot skipped: ${type} live value missing or empty`);
    return false;
  }

  const entries = await readSnapshotArray<unknown>(env, type);
  entries.unshift({ timestamp: new Date().toISOString(), data: live });
  const trimmed = entries.slice(0, MAX_SNAPSHOTS);
  await writeSnapshotArray(env, type, trimmed);
  console.log(`snapshot captured: ${type} (rolling=${trimmed.length})`);
  return true;
}

/**
 * Capture all known snapshot types. Returns a report for logging.
 */
export async function captureAllSnapshots(env: Env): Promise<{
  captured: SnapshotType[];
  skipped: SnapshotType[];
}> {
  const allTypes: SnapshotType[] = [
    'news',
    'status:services',
    'status:summary',
    'status:incidents',
    'models',
    'benchmarks',
    'podcasts',
    'trending-repos',
  ];

  const captured: SnapshotType[] = [];
  const skipped: SnapshotType[] = [];

  for (const type of allTypes) {
    try {
      const ok = await captureSnapshot(env, type);
      if (ok) captured.push(type);
      else skipped.push(type);
    } catch (err) {
      console.error(`snapshot error for ${type}:`, err);
      skipped.push(type);
    }
  }

  return { captured, skipped };
}

/**
 * Read the latest snapshot for a given type without modifying anything.
 */
export async function getLatestSnapshot<T>(
  env: Env,
  type: SnapshotType,
): Promise<SnapshotEntry<T> | null> {
  const entries = await readSnapshotArray<T>(env, type);
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Restore a specific type from the most recent snapshot back into the live
 * KV key. Used when the live value is missing, empty, or stale. Returns
 * true if a restore happened.
 */
export async function restoreFromSnapshot(env: Env, type: SnapshotType): Promise<boolean> {
  const latest = await getLatestSnapshot<unknown>(env, type);
  if (!latest) {
    console.warn(`restore skipped: no snapshot available for ${type}`);
    return false;
  }

  const ns = namespaceFor(env, type);
  await ns.put(liveKeyFor(type), JSON.stringify(latest.data));

  // Also refresh the news meta record so /api/health reflects the restore.
  if (type === 'news') {
    const articles = latest.data as Article[];
    await env.TENSORFEED_NEWS.put(
      'meta',
      JSON.stringify({
        totalArticles: articles.length,
        sourcesPolled: 0,
        sourcesSucceeded: 0,
        lastUpdated: new Date().toISOString(),
        restoredFromSnapshot: true,
        snapshotTimestamp: latest.timestamp,
      }),
    );
    // Also refresh articles:latest so lightweight readers see fresh data.
    await env.TENSORFEED_NEWS.put('articles:latest', JSON.stringify(articles.slice(0, 50)));
  }

  console.log(`restored ${type} from snapshot dated ${latest.timestamp}`);
  return true;
}

/**
 * Summarize snapshot state for debug endpoints. Small response, safe to
 * expose publicly (no secrets, just counts and timestamps).
 */
export async function getSnapshotSummary(
  env: Env,
): Promise<Record<SnapshotType, { count: number; newest: string | null; oldest: string | null }>> {
  const allTypes: SnapshotType[] = [
    'news',
    'status:services',
    'status:summary',
    'status:incidents',
    'models',
    'benchmarks',
    'podcasts',
    'trending-repos',
  ];

  const summary = {} as Record<SnapshotType, { count: number; newest: string | null; oldest: string | null }>;
  for (const type of allTypes) {
    const entries = await readSnapshotArray(env, type);
    summary[type] = {
      count: entries.length,
      newest: entries[0]?.timestamp ?? null,
      oldest: entries[entries.length - 1]?.timestamp ?? null,
    };
  }
  return summary;
}

export type { SnapshotType };
