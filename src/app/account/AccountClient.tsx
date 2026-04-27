'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Activity,
  Bell,
  Trash2,
  ExternalLink,
  AlertTriangle,
  KeyRound,
  RefreshCcw,
  Plus,
} from 'lucide-react';

const API_BASE = 'https://tensorfeed.ai/api';
const SESSION_KEY = 'tf_account_session';

interface BalanceResponse {
  ok: boolean;
  balance: number;
  created: string;
  last_used: string;
  total_purchased: number;
}

interface UsageEntry {
  endpoint: string;
  credits: number;
  at: string;
}

interface UsageResponse {
  ok: boolean;
  token_balance: number | null;
  total_calls: number;
  total_credits_spent: number;
  by_endpoint: Record<string, { calls: number; credits: number; last_seen: string }>;
  recent: UsageEntry[];
}

interface WatchSpec {
  type: 'price' | 'status';
  model?: string;
  field?: string;
  op?: string;
  threshold?: number;
  provider?: string;
  value?: string;
}

interface Watch {
  id: string;
  spec: WatchSpec;
  callback_url: string;
  created: string;
  expires_at: string;
  fire_count: number;
  fire_cap: number;
  last_fired_at: string | null;
  last_delivery_status: number | null;
  status: 'active' | 'expired' | 'cap_reached' | 'deleted';
}

interface WatchListResponse {
  ok: boolean;
  count: number;
  watches: Watch[];
}

function shortToken(token: string): string {
  if (token.length < 18) return token;
  return `${token.slice(0, 12)}…${token.slice(-4)}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describeWatch(spec: WatchSpec): string {
  if (spec.type === 'price') {
    const op = spec.op === 'lt' ? '<' : spec.op === 'gt' ? '>' : 'changes';
    if (spec.op === 'changes') {
      return `${spec.model} ${spec.field} changes`;
    }
    return `${spec.model} ${spec.field} ${op} ${spec.threshold}`;
  }
  if (spec.type === 'status') {
    return spec.op === 'becomes'
      ? `${spec.provider} becomes ${spec.value}`
      : `${spec.provider} status changes`;
  }
  return JSON.stringify(spec);
}

export default function AccountClient() {
  const [tokenInput, setTokenInput] = useState('');
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore from sessionStorage (clears on tab close, never localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setTokenInput(stored);
      setActiveToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!activeToken) return;
    void loadAccount(activeToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  async function loadAccount(token: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [bRes, uRes, wRes] = await Promise.all([
        fetch(`${API_BASE}/payment/balance`, { headers }),
        fetch(`${API_BASE}/payment/usage`, { headers }),
        fetch(`${API_BASE}/premium/watches`, { headers }),
      ]);
      if (!bRes.ok) {
        const body = await bRes.json().catch(() => ({}));
        throw new Error(body.error || `Token check failed (${bRes.status})`);
      }
      const bJson = (await bRes.json()) as BalanceResponse;
      const uJson = uRes.ok ? ((await uRes.json()) as UsageResponse) : null;
      const wJson = wRes.ok ? ((await wRes.json()) as WatchListResponse) : null;
      setBalance(bJson);
      setUsage(uJson);
      setWatches(wJson?.watches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account');
      setBalance(null);
      setUsage(null);
      setWatches([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed.startsWith('tf_live_')) {
      setError('Token must start with tf_live_');
      return;
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY, trimmed);
    }
    setActiveToken(trimmed);
  }

  function signOut(): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
    setActiveToken(null);
    setTokenInput('');
    setBalance(null);
    setUsage(null);
    setWatches([]);
    setError(null);
  }

  async function handleDeleteWatch(id: string): Promise<void> {
    if (!activeToken) return;
    if (!window.confirm('Delete this watch? This cannot be undone.')) return;
    const res = await fetch(`${API_BASE}/premium/watches/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (res.ok) {
      setWatches(prev => prev.filter(w => w.id !== id));
    } else {
      const body = await res.json().catch(() => ({}));
      window.alert(`Delete failed: ${body.error || res.status}`);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Account Dashboard</h1>
        <p className="text-text-secondary max-w-2xl">
          Paste a TensorFeed bearer token to see balance, recent premium API usage, and active
          webhook watches. There are no accounts: the token is the credential.
        </p>
      </div>

      {/* Security warning */}
      <div className="mb-6 bg-bg-secondary border border-amber-500/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary">
          <p className="text-text-primary font-semibold mb-1">Token security</p>
          <p>
            Treat your token like a credit card. We do not store it in your browser beyond the
            current tab (sessionStorage only, cleared when you close the tab). Do not paste your
            token on a shared computer. Anyone with the token can spend the credits.
          </p>
        </div>
      </div>

      {!activeToken && (
        <form
          onSubmit={handleSubmit}
          className="bg-bg-secondary border border-border rounded-xl p-6 mb-6"
        >
          <label htmlFor="token" className="block text-sm font-semibold text-text-primary mb-2">
            <KeyRound className="w-4 h-4 inline mr-2" />
            Bearer token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="off"
            spellCheck="false"
            placeholder="tf_live_..."
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            aria-label="Bearer token"
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="submit"
              className="bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg px-5 py-2 text-sm flex items-center gap-2 transition"
            >
              <Activity className="w-4 h-4" />
              Load account
            </button>
            <Link
              href="/developers/agent-payments"
              className="bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border text-text-primary font-semibold rounded-lg px-5 py-2 text-sm flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Don&apos;t have a token? Buy credits
            </Link>
          </div>
        </form>
      )}

      {activeToken && (
        <>
          {/* Header row: token id + actions */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-accent-primary" />
              <code className="font-mono text-sm text-text-primary">
                {shortToken(activeToken)}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => activeToken && loadAccount(activeToken)}
                disabled={loading}
                className="bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border rounded-lg px-3 py-1.5 text-sm flex items-center gap-2"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={signOut}
                className="bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border rounded-lg px-3 py-1.5 text-sm"
              >
                Sign out
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Balance + metadata */}
          {balance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wide mb-1">
                  <Wallet className="w-4 h-4" />
                  Balance
                </div>
                <div className="text-3xl font-bold text-accent-primary font-mono">
                  {balance.balance}
                </div>
                <div className="text-text-muted text-xs mt-1">credits</div>
              </div>
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="text-text-muted text-xs uppercase tracking-wide mb-1">
                  Total purchased
                </div>
                <div className="text-3xl font-bold text-text-primary font-mono">
                  {balance.total_purchased}
                </div>
                <div className="text-text-muted text-xs mt-1">lifetime credits</div>
              </div>
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="text-text-muted text-xs uppercase tracking-wide mb-1">Created</div>
                <div className="text-text-primary font-mono text-sm">
                  {formatDate(balance.created)}
                </div>
                <div className="text-text-muted text-xs mt-1">{formatRelative(balance.created)}</div>
              </div>
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="text-text-muted text-xs uppercase tracking-wide mb-1">
                  Last used
                </div>
                <div className="text-text-primary font-mono text-sm">
                  {formatDate(balance.last_used)}
                </div>
                <div className="text-text-muted text-xs mt-1">
                  {formatRelative(balance.last_used)}
                </div>
              </div>
            </div>
          )}

          {/* Top up CTA */}
          <div className="mb-6 bg-bg-secondary border border-border rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-text-primary font-semibold mb-1">Need more credits?</p>
              <p className="text-text-muted text-sm">
                Buy credits with USDC on Base. Your existing token is debited automatically when
                you confirm.
              </p>
            </div>
            <Link
              href="/developers/agent-payments"
              className="bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg px-5 py-2 text-sm flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Buy credits
            </Link>
          </div>

          {/* Per-endpoint usage */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent-primary" />
              Premium API usage
            </h2>
            {usage && usage.total_calls > 0 ? (
              <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg-tertiary text-text-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Endpoint</th>
                      <th className="text-right px-4 py-2.5">Calls</th>
                      <th className="text-right px-4 py-2.5">Credits</th>
                      <th className="text-right px-4 py-2.5">Last used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usage.by_endpoint)
                      .sort(([, a], [, b]) => b.calls - a.calls)
                      .map(([endpoint, info]) => (
                        <tr key={endpoint} className="border-t border-border">
                          <td className="px-4 py-2.5 font-mono text-text-primary">{endpoint}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{info.calls}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-accent-primary">
                            {info.credits}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-muted text-xs">
                            {formatRelative(info.last_seen)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-bg-tertiary/50">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-text-primary">Total</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {usage.total_calls}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-accent-primary">
                        {usage.total_credits_spent}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                <p className="text-text-muted text-xs px-4 py-2.5 border-t border-border">
                  Showing the last {usage.total_calls} premium API calls for this token (capped at
                  100).
                </p>
              </div>
            ) : (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 text-text-muted text-sm">
                No premium API calls yet for this token. Try{' '}
                <Link href="/developers/agent-payments" className="text-accent-primary underline">
                  the routing endpoint
                </Link>{' '}
                or any of the history series.
              </div>
            )}
          </section>

          {/* Active watches */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent-primary" />
              Active webhook watches
              {watches.length > 0 && (
                <span className="text-text-muted text-sm font-normal">
                  ({watches.length} of 25 max)
                </span>
              )}
            </h2>
            {watches.length > 0 ? (
              <div className="space-y-3">
                {watches.map(w => (
                  <div
                    key={w.id}
                    className="bg-bg-secondary border border-border rounded-xl p-4 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs uppercase tracking-wide bg-accent-primary/20 text-accent-primary rounded px-2 py-0.5 font-semibold">
                          {w.spec.type}
                        </span>
                        <code className="font-mono text-xs text-text-muted">
                          {w.id.slice(0, 16)}…
                        </code>
                      </div>
                      <p className="text-text-primary font-mono text-sm break-words">
                        {describeWatch(w.spec)}
                      </p>
                      <p className="text-text-muted text-xs mt-1 break-all">
                        → {w.callback_url}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-2">
                        <span>Fired: {w.fire_count}/{w.fire_cap}</span>
                        {w.last_fired_at && <span>Last: {formatRelative(w.last_fired_at)}</span>}
                        <span>Expires: {formatDate(w.expires_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteWatch(w.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg p-2 transition"
                      aria-label={`Delete watch ${w.id}`}
                      title="Delete watch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 text-text-muted text-sm">
                No active watches.{' '}
                <Link href="/developers/agent-payments" className="text-accent-primary underline">
                  Read the watches docs
                </Link>{' '}
                to register one.
              </div>
            )}
          </section>

          {/* Recent calls */}
          {usage && usage.recent.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xl font-semibold text-text-primary mb-3">Recent calls</h2>
              <div className="bg-bg-secondary border border-border rounded-xl divide-y divide-border">
                {usage.recent.map((entry, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <code className="font-mono text-text-primary truncate">
                      {entry.endpoint}
                    </code>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      <span className="text-accent-primary font-mono">−{entry.credits}</span>
                      <span className="text-text-muted text-xs">{formatRelative(entry.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer links */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link
              href="/developers/agent-payments"
              className="text-text-muted hover:text-accent-primary inline-flex items-center gap-1"
            >
              Agent Payments docs <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              href="/developers"
              className="text-text-muted hover:text-accent-primary inline-flex items-center gap-1"
            >
              Free API docs <ExternalLink className="w-3 h-3" />
            </Link>
            <Link href="/terms" className="text-text-muted hover:text-accent-primary">
              Terms
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
