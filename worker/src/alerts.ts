import { Env } from './types';
import { RSSPollResult } from './rss';

/**
 * Alerting + failure history.
 *
 * Pragmatic alerting: email is only sent when data actually ages past the
 * staleness threshold (not on every transient fetch failure). Throttled so
 * the same alert class cannot fire more than once per hour.
 *
 * Daily summary: once per day at 8am UTC, if any RSS source failures were
 * recorded in the last 24 hours, send one digest email summarizing them.
 * If everything ran clean, no email is sent.
 */

const SOURCE_HISTORY_KEY = 'source-history';
const ALERT_STATE_KEY = 'alert-state';
const SOURCE_HISTORY_MAX_AGE_MS = 25 * 60 * 60 * 1000;
const STALE_NEWS_THRESHOLD_MS = 30 * 60 * 1000;
const STALE_ALERT_THROTTLE_MS = 60 * 60 * 1000;

interface HistoryEntry {
  timestamp: string;
  cron: string;
  sources: Array<{
    id: string;
    name: string;
    status: 'ok' | 'empty' | 'error';
    articles: number;
    error?: string;
  }>;
}

interface AlertState {
  lastStaleAlertAt?: string;
  lastDailySummaryAt?: string;
  lastRestoreAlertAt?: string;
}

async function getAlertState(env: Env): Promise<AlertState> {
  const raw = (await env.TENSORFEED_CACHE.get(ALERT_STATE_KEY, 'json')) as AlertState | null;
  return raw || {};
}

async function setAlertState(env: Env, state: AlertState): Promise<void> {
  await env.TENSORFEED_CACHE.put(ALERT_STATE_KEY, JSON.stringify(state));
}

/**
 * Send an email via the Resend API. Returns true on success, false on
 * failure. Failures are logged but never thrown so the caller can keep
 * running the rest of the cron pipeline.
 */
async function sendEmail(
  env: Env,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('sendEmail skipped: RESEND_API_KEY not set');
    return false;
  }
  if (!env.ALERT_EMAIL_TO || !env.ALERT_EMAIL_FROM) {
    console.warn('sendEmail skipped: ALERT_EMAIL_TO or ALERT_EMAIL_FROM not set');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `TensorFeed Alerts <${env.ALERT_EMAIL_FROM}>`,
        to: [env.ALERT_EMAIL_TO],
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Resend API failed: ${res.status} ${body}`);
      return false;
    }
    console.log(`alert email sent: ${subject}`);
    return true;
  } catch (err) {
    console.error('sendEmail error:', err);
    return false;
  }
}

/**
 * Append a poll run to the rolling 24 hour history. Older than 25 hours
 * entries are pruned.
 */
export async function recordPollRun(
  env: Env,
  cron: string,
  result: RSSPollResult,
): Promise<void> {
  const existing = (await env.TENSORFEED_CACHE.get(SOURCE_HISTORY_KEY, 'json')) as
    | HistoryEntry[]
    | null;
  const entries = Array.isArray(existing) ? existing : [];

  const now = Date.now();
  const pruned = entries.filter((e) => {
    const t = Date.parse(e.timestamp);
    return Number.isFinite(t) && now - t < SOURCE_HISTORY_MAX_AGE_MS;
  });

  pruned.push({
    timestamp: new Date().toISOString(),
    cron,
    sources: result.sourceResults,
  });

  await env.TENSORFEED_CACHE.put(SOURCE_HISTORY_KEY, JSON.stringify(pruned));
}

interface NewsMeta {
  totalArticles?: number;
  lastUpdated?: string;
  restoredFromSnapshot?: boolean;
  snapshotTimestamp?: string;
}

/**
 * Check if the news feed is stale past the threshold. If so, caller should
 * trigger a snapshot restore and this function will send a throttled email
 * alert describing the situation.
 */
export async function checkNewsStaleness(env: Env): Promise<{
  stale: boolean;
  ageMinutes: number;
  lastUpdated: string | null;
}> {
  const meta = (await env.TENSORFEED_NEWS.get('meta', 'json')) as NewsMeta | null;
  if (!meta?.lastUpdated) {
    return { stale: true, ageMinutes: Infinity, lastUpdated: null };
  }
  const ageMs = Date.now() - Date.parse(meta.lastUpdated);
  const ageMinutes = Math.round(ageMs / 60_000);
  return {
    stale: ageMs > STALE_NEWS_THRESHOLD_MS,
    ageMinutes,
    lastUpdated: meta.lastUpdated,
  };
}

/**
 * Send a throttled alert describing a stale feed + fallback restore. Skips
 * if an identical alert was sent less than STALE_ALERT_THROTTLE_MS ago.
 */
export async function alertStaleNews(
  env: Env,
  opts: {
    ageMinutes: number;
    lastUpdated: string | null;
    restored: boolean;
    snapshotTimestamp: string | null;
  },
): Promise<'sent' | 'throttled' | 'skipped'> {
  const state = await getAlertState(env);
  const now = Date.now();

  if (state.lastStaleAlertAt) {
    const elapsed = now - Date.parse(state.lastStaleAlertAt);
    if (elapsed < STALE_ALERT_THROTTLE_MS) {
      console.log(`stale alert throttled (${Math.round(elapsed / 60_000)}m since last)`);
      return 'throttled';
    }
  }

  const subject = opts.restored
    ? `[TensorFeed] News feed stale, restored from snapshot`
    : `[TensorFeed] News feed stale, no snapshot available`;

  const ageDisplay = Number.isFinite(opts.ageMinutes)
    ? `${opts.ageMinutes} minutes`
    : 'unknown (no meta)';

  const lastDisplay = opts.lastUpdated || 'never';
  const snapDisplay = opts.snapshotTimestamp || 'none';

  const html = `
    <h2 style="color:#ef4444;margin:0 0 12px">TensorFeed news feed stale</h2>
    <p>The main RSS aggregation pipeline has not updated in <strong>${ageDisplay}</strong>.</p>
    <table style="border-collapse:collapse;font-family:ui-monospace,Menlo,monospace;font-size:13px">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Last live update</td><td>${lastDisplay}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Fallback action</td><td>${opts.restored ? 'Restored from snapshot' : 'No snapshot to restore'}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Snapshot timestamp</td><td>${snapDisplay}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Alert sent at</td><td>${new Date().toISOString()}</td></tr>
    </table>
    <p style="margin-top:16px">
      Debug: <a href="https://tensorfeed.ai/api/cron-status">/api/cron-status</a> |
      <a href="https://tensorfeed.ai/api/health">/api/health</a> |
      <a href="https://tensorfeed.ai/api/snapshots">/api/snapshots</a>
    </p>
    <p style="color:#94a3b8;font-size:12px">Throttled: at most one alert per hour. Daily summary still sends at 08:30 UTC.</p>
  `;

  const text = [
    `TensorFeed news feed stale`,
    ``,
    `Age: ${ageDisplay}`,
    `Last live update: ${lastDisplay}`,
    `Fallback: ${opts.restored ? 'Restored from snapshot' : 'No snapshot to restore'}`,
    `Snapshot timestamp: ${snapDisplay}`,
    `Alert sent at: ${new Date().toISOString()}`,
    ``,
    `Debug: https://tensorfeed.ai/api/cron-status`,
  ].join('\n');

  const ok = await sendEmail(env, subject, html, text);
  if (ok) {
    await setAlertState(env, { ...state, lastStaleAlertAt: new Date().toISOString() });
    return 'sent';
  }
  return 'skipped';
}

interface SourceAggregate {
  id: string;
  name: string;
  total: number;
  ok: number;
  failed: number;
  empty: number;
  lastSuccess: string | null;
  lastError: string | null;
}

/**
 * Walk the rolling 24 hour source history and compute per-source success
 * rates. Returns only sources that had at least one failure (ok=false or
 * empty) so the daily email can show only what matters.
 */
async function computeDailyFailureSummary(env: Env): Promise<SourceAggregate[]> {
  const entries = ((await env.TENSORFEED_CACHE.get(SOURCE_HISTORY_KEY, 'json')) as
    | HistoryEntry[]
    | null) || [];
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  const recent = entries.filter((e) => {
    const t = Date.parse(e.timestamp);
    return Number.isFinite(t) && t >= cutoff;
  });

  const byId = new Map<string, SourceAggregate>();

  for (const entry of recent) {
    for (const s of entry.sources) {
      let agg = byId.get(s.id);
      if (!agg) {
        agg = {
          id: s.id,
          name: s.name,
          total: 0,
          ok: 0,
          failed: 0,
          empty: 0,
          lastSuccess: null,
          lastError: null,
        };
        byId.set(s.id, agg);
      }
      agg.total += 1;
      if (s.status === 'ok') {
        agg.ok += 1;
        if (!agg.lastSuccess || agg.lastSuccess < entry.timestamp) {
          agg.lastSuccess = entry.timestamp;
        }
      } else if (s.status === 'empty') {
        agg.empty += 1;
      } else {
        agg.failed += 1;
        if (s.error) agg.lastError = s.error;
      }
    }
  }

  return [...byId.values()]
    .filter((agg) => agg.failed > 0 || agg.empty > 0)
    .sort((a, b) => {
      const aBad = a.failed + a.empty;
      const bBad = b.failed + b.empty;
      return bBad - aBad;
    });
}

function formatRate(ok: number, total: number): string {
  if (total === 0) return 'n/a';
  return `${Math.round((ok / total) * 100)}%`;
}

/**
 * Send a daily summary email of RSS source health. No-op if nothing failed
 * in the last 24 hours. Called from the scheduled handler once per day.
 */
export async function sendDailySummary(env: Env): Promise<'sent' | 'clean' | 'skipped'> {
  const state = await getAlertState(env);
  const now = new Date();

  const failures = await computeDailyFailureSummary(env);
  if (failures.length === 0) {
    console.log('daily summary: 24h clean, no email sent');
    await setAlertState(env, { ...state, lastDailySummaryAt: now.toISOString() });
    return 'clean';
  }

  const rows = failures
    .map(
      (f) => `
        <tr>
          <td style="padding:6px 12px;border-top:1px solid #e2e8f0">${f.name}</td>
          <td style="padding:6px 12px;border-top:1px solid #e2e8f0;text-align:right">${formatRate(f.ok, f.total)}</td>
          <td style="padding:6px 12px;border-top:1px solid #e2e8f0;text-align:right">${f.failed + f.empty}</td>
          <td style="padding:6px 12px;border-top:1px solid #e2e8f0;font-family:ui-monospace,Menlo,monospace;font-size:12px">${f.lastSuccess || 'never'}</td>
        </tr>
      `,
    )
    .join('');

  const html = `
    <h2 style="margin:0 0 12px">TensorFeed daily RSS summary</h2>
    <p>Window: last 24 hours ending ${now.toISOString()}</p>
    <p><strong>${failures.length}</strong> source(s) had failures in the last 24 hours.</p>
    <table style="border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left">Source</th>
          <th style="padding:8px 12px;text-align:right">Success rate</th>
          <th style="padding:8px 12px;text-align:right">Failed fetches</th>
          <th style="padding:8px 12px;text-align:left">Last success</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;color:#64748b;font-size:12px">
      Clean days produce no email. Alerts on stale data throttled to one per hour.
      Debug: <a href="https://tensorfeed.ai/api/cron-status">/api/cron-status</a>
    </p>
  `;

  const textRows = failures
    .map(
      (f) =>
        `  ${f.name}: ${formatRate(f.ok, f.total)} success, ${f.failed + f.empty} failures, last ok ${f.lastSuccess || 'never'}`,
    )
    .join('\n');
  const text = [
    `TensorFeed daily RSS summary`,
    `Window: last 24 hours ending ${now.toISOString()}`,
    ``,
    `${failures.length} source(s) had failures in the last 24 hours:`,
    textRows,
  ].join('\n');

  const ok = await sendEmail(env, `[TensorFeed] Daily RSS summary (${failures.length} source issue${failures.length === 1 ? '' : 's'})`, html, text);
  if (ok) {
    await setAlertState(env, { ...state, lastDailySummaryAt: now.toISOString() });
    return 'sent';
  }
  return 'skipped';
}

/**
 * Expose alert state for the debug endpoint.
 */
export async function getAlertsStatus(env: Env): Promise<{
  state: AlertState;
  recentFailures: SourceAggregate[];
  historyCount: number;
}> {
  const state = await getAlertState(env);
  const recentFailures = await computeDailyFailureSummary(env);
  const entries = ((await env.TENSORFEED_CACHE.get(SOURCE_HISTORY_KEY, 'json')) as
    | HistoryEntry[]
    | null) || [];
  return {
    state,
    recentFailures,
    historyCount: entries.length,
  };
}
