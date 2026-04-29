import { describe, it, expect } from 'vitest';
import { dedupLatest, summarize, resolveRange, MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS, RegistryServer } from './mcp-registry';

const meta = (over: Record<string, unknown> = {}) => ({
  'io.modelcontextprotocol.registry/official': {
    status: 'active',
    publishedAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    statusChangedAt: '2026-04-01T00:00:00Z',
    isLatest: true,
    ...over,
  },
});

describe('dedupLatest', () => {
  it('keeps one entry per server name and prefers isLatest=true', () => {
    const result = dedupLatest([
      { server: { name: 'foo/bar', version: '1.0.0' }, _meta: meta({ isLatest: false, updatedAt: '2026-04-10T00:00:00Z' }) },
      { server: { name: 'foo/bar', version: '1.1.0' }, _meta: meta({ isLatest: true, updatedAt: '2026-04-15T00:00:00Z' }) },
      { server: { name: 'foo/bar', version: '0.9.0' }, _meta: meta({ isLatest: false, updatedAt: '2026-03-01T00:00:00Z' }) },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('foo/bar');
    expect(result[0].version).toBe('1.1.0');
  });

  it('falls back to most recent updatedAt when no entry is isLatest', () => {
    const result = dedupLatest([
      { server: { name: 'foo/bar', version: '1.0.0' }, _meta: meta({ isLatest: false, updatedAt: '2026-04-10T00:00:00Z' }) },
      { server: { name: 'foo/bar', version: '1.1.0' }, _meta: meta({ isLatest: false, updatedAt: '2026-04-15T00:00:00Z' }) },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('1.1.0');
  });

  it('drops entries without a name', () => {
    const result = dedupLatest([
      { server: { version: '1.0.0' }, _meta: meta() } as { server: { version: string }; _meta: ReturnType<typeof meta> },
      { server: { name: 'foo/bar', version: '1.0.0' }, _meta: meta() },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('foo/bar');
  });

  it('counts remotes', () => {
    const result = dedupLatest([
      { server: { name: 'a/b', version: '1.0', remotes: [{ url: 'https://x' }, { url: 'https://y' }] }, _meta: meta() },
      { server: { name: 'c/d', version: '1.0' }, _meta: meta() },
    ]);
    expect(result.find(r => r.name === 'a/b')!.remote_count).toBe(2);
    expect(result.find(r => r.name === 'c/d')!.remote_count).toBe(0);
  });

  it('returns servers sorted by name', () => {
    const result = dedupLatest([
      { server: { name: 'z/last', version: '1.0' }, _meta: meta() },
      { server: { name: 'a/first', version: '1.0' }, _meta: meta() },
      { server: { name: 'm/mid', version: '1.0' }, _meta: meta() },
    ]);
    expect(result.map(r => r.name)).toEqual(['a/first', 'm/mid', 'z/last']);
  });
});

describe('summarize', () => {
  const baseOpts = {
    date: '2026-04-29',
    capturedAt: '2026-04-29T09:30:00Z',
    pagesFetched: 2,
    fetchTruncated: false,
    rawTotalVersions: 250,
    yesterdayServers: null,
    yesterdaySummary: null,
  };

  it('counts by status and namespace', () => {
    const servers: RegistryServer[] = [
      { name: 'ai.foo/x', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'ai.foo/y', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'ai.bar/z', status: 'deprecated', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const s = summarize(servers, baseOpts);
    expect(s.total_servers).toBe(3);
    expect(s.total_versions).toBe(250);
    expect(s.by_status).toEqual({ active: 2, deprecated: 1 });
    expect(s.top_namespaces).toEqual([
      { namespace: 'ai.foo', count: 2 },
      { namespace: 'ai.bar', count: 1 },
    ]);
    expect(s.delta_vs_yesterday).toBeNull();
    expect(s.new_today.count).toBe(0);
  });

  it('detects newly added servers vs yesterday', () => {
    const yesterday: RegistryServer[] = [
      { name: 'a/old', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const today: RegistryServer[] = [
      { name: 'a/old', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'a/new', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const s = summarize(today, { ...baseOpts, yesterdayServers: yesterday });
    expect(s.new_today.count).toBe(1);
    expect(s.new_today.names).toEqual(['a/new']);
    expect(s.delta_vs_yesterday).toEqual({ added: 1, removed: 0, net: 1 });
  });

  it('detects status transitions for reactivated and deprecated', () => {
    const yesterday: RegistryServer[] = [
      { name: 'a/x', status: 'deprecated', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'a/y', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const today: RegistryServer[] = [
      { name: 'a/x', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'a/y', status: 'deprecated', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const s = summarize(today, { ...baseOpts, yesterdayServers: yesterday });
    expect(s.reactivated_today.names).toEqual(['a/x']);
    expect(s.deprecated_today.names).toEqual(['a/y']);
  });

  it('caps new_today.names list to 50 even when count is higher', () => {
    const today: RegistryServer[] = Array.from({ length: 60 }, (_, i) => ({
      name: `a/n${i}`,
      status: 'active',
      publishedAt: '',
      updatedAt: '',
      statusChangedAt: '',
      remote_count: 0,
      repository_url: null,
      repository_source: null,
    }));
    const s = summarize(today, { ...baseOpts, yesterdayServers: [] });
    expect(s.new_today.count).toBe(60);
    expect(s.new_today.names).toHaveLength(50);
  });

  it('detects net negative when servers are removed', () => {
    const yesterday: RegistryServer[] = [
      { name: 'a/x', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
      { name: 'a/y', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const today: RegistryServer[] = [
      { name: 'a/x', status: 'active', publishedAt: '', updatedAt: '', statusChangedAt: '', remote_count: 0, repository_url: null, repository_source: null },
    ];
    const s = summarize(today, { ...baseOpts, yesterdayServers: yesterday });
    expect(s.delta_vs_yesterday).toEqual({ added: 0, removed: 1, net: -1 });
  });
});

describe('resolveRange', () => {
  it('defaults to a 30-day window ending today when no params', () => {
    const r = resolveRange(null, null);
    expect(r.ok).toBe(true);
    expect(r.to).toBe(new Date().toISOString().slice(0, 10));
    // span 29 means 30 days inclusive
    const dFrom = new Date(`${r.from}T00:00:00Z`).getTime();
    const dTo = new Date(`${r.to}T00:00:00Z`).getTime();
    const span = Math.round((dTo - dFrom) / (1000 * 60 * 60 * 24));
    expect(span).toBe(DEFAULT_RANGE_DAYS - 1);
  });

  it('rejects invalid date formats', () => {
    expect(resolveRange('2026/04/01', null).ok).toBe(false);
    expect(resolveRange(null, 'yesterday').ok).toBe(false);
    expect(resolveRange('2026-04-01', '2026-04-1').ok).toBe(false);
  });

  it('rejects from after to', () => {
    const r = resolveRange('2026-04-15', '2026-04-10');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('from_after_to');
  });

  it('rejects ranges that exceed the 90-day cap', () => {
    const r = resolveRange('2026-01-01', '2026-04-30');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('range_exceeds_max_days');
  });

  it('accepts a 90-day range exactly at the cap', () => {
    const r = resolveRange('2026-02-01', '2026-05-01');
    expect(r.ok).toBe(true);
  });

  it('exposes the limits via constants', () => {
    expect(MAX_RANGE_DAYS).toBe(90);
    expect(DEFAULT_RANGE_DAYS).toBe(30);
  });
});
