import { describe, it, expect } from 'vitest';
import {
  percentile,
  aggregateResults,
  resolveRange,
  listProviders,
  PROBE_MAX_RANGE_DAYS,
  PROBE_DEFAULT_RANGE_DAYS,
  ProbeResult,
} from './probe';

const probe = (over: Partial<ProbeResult> = {}): ProbeResult => ({
  provider: 'anthropic',
  timestamp: '2026-04-29T12:00:00.000Z',
  ok: true,
  status: 200,
  ttfb_ms: 100,
  total_ms: 200,
  ...over,
});

describe('percentile', () => {
  it('returns null for empty input', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('returns the only value for a single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.99)).toBe(42);
  });

  it('approximates p50 from a sorted population', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(6);
  });

  it('returns the highest value at p99 for typical sample sizes', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.99)).toBe(100);
  });

  it('is order-insensitive', () => {
    const a = [10, 1, 50, 25, 5];
    const b = [...a].reverse();
    expect(percentile(a, 0.5)).toBe(percentile(b, 0.5));
  });
});

describe('aggregateResults', () => {
  it('handles empty input gracefully', () => {
    const a = aggregateResults('anthropic', []);
    expect(a.count).toBe(0);
    expect(a.success_count).toBe(0);
    expect(a.ok_pct).toBe(0);
    expect(a.ttfb.p50).toBeNull();
    expect(a.last_probe_at).toBeNull();
  });

  it('computes ok_pct from mixed results', () => {
    const results = [
      probe({ ok: true }),
      probe({ ok: true }),
      probe({ ok: false, status: 500, error: 'http_500' }),
      probe({ ok: false, status: 0, error: 'fetch_failed' }),
    ];
    const a = aggregateResults('anthropic', results);
    expect(a.count).toBe(4);
    expect(a.success_count).toBe(2);
    expect(a.ok_pct).toBe(0.5);
  });

  it('computes percentile latency only over successful probes', () => {
    // Failed probes should not pollute the latency series
    const results = [
      probe({ ok: true, ttfb_ms: 100, total_ms: 200 }),
      probe({ ok: true, ttfb_ms: 200, total_ms: 400 }),
      probe({ ok: true, ttfb_ms: 300, total_ms: 600 }),
      probe({ ok: false, status: 500, ttfb_ms: 9999, total_ms: 9999, error: 'x' }),
    ];
    const a = aggregateResults('anthropic', results);
    expect(a.ttfb.p50).toBe(200);
    expect(a.total.p50).toBe(400);
    // Failure latency should NOT be in the series, so p99 should not be 9999
    expect(a.ttfb.p99).not.toBe(9999);
  });

  it('groups status codes including failures', () => {
    const results = [
      probe({ status: 200, ok: true }),
      probe({ status: 200, ok: true }),
      probe({ status: 429, ok: false, error: 'rate_limited' }),
      probe({ status: 500, ok: false, error: 'http_500' }),
      probe({ status: 0, ok: false, error: 'fetch_failed' }),
    ];
    const a = aggregateResults('anthropic', results);
    expect(a.status_codes).toEqual({ '200': 2, '429': 1, '500': 1, '0': 1 });
  });

  it('exposes the most recent probe timestamp', () => {
    const results = [
      probe({ timestamp: '2026-04-29T10:00:00.000Z' }),
      probe({ timestamp: '2026-04-29T11:00:00.000Z' }),
      probe({ timestamp: '2026-04-29T12:00:00.000Z' }),
    ];
    const a = aggregateResults('anthropic', results);
    expect(a.last_probe_at).toBe('2026-04-29T12:00:00.000Z');
  });

  it('exposes the most recent error message when failures exist', () => {
    const results = [
      probe({ ok: false, status: 500, error: 'old', timestamp: '2026-04-29T10:00:00.000Z' }),
      probe({ ok: true }),
      probe({ ok: false, status: 429, error: 'newest', timestamp: '2026-04-29T12:00:00.000Z' }),
    ];
    const a = aggregateResults('anthropic', results);
    expect(a.last_error).toBe('newest');
  });

  it('reports null last_error when nothing has failed', () => {
    const results = [probe({ ok: true }), probe({ ok: true })];
    const a = aggregateResults('anthropic', results);
    expect(a.last_error).toBeNull();
  });
});

describe('resolveRange', () => {
  it('defaults to a 30-day window ending today', () => {
    const r = resolveRange(null, null);
    expect(r.ok).toBe(true);
    expect(r.to).toBe(new Date().toISOString().slice(0, 10));
    const span = Math.round(
      (new Date(`${r.to}T00:00:00Z`).getTime() - new Date(`${r.from}T00:00:00Z`).getTime()) / 86400000,
    );
    expect(span).toBe(PROBE_DEFAULT_RANGE_DAYS - 1);
  });

  it('rejects malformed dates', () => {
    expect(resolveRange('2026/04/01', null).ok).toBe(false);
    expect(resolveRange(null, 'today').ok).toBe(false);
  });

  it('rejects from after to', () => {
    const r = resolveRange('2026-04-15', '2026-04-10');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('from_after_to');
  });

  it('caps the range at 90 days', () => {
    const r = resolveRange('2026-01-01', '2026-04-30');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('range_exceeds_max_days');
  });

  it('accepts an exactly-90-day range', () => {
    const r = resolveRange('2026-02-01', '2026-05-01');
    expect(r.ok).toBe(true);
  });

  it('exposes constants for SDK consumers', () => {
    expect(PROBE_MAX_RANGE_DAYS).toBe(90);
    expect(PROBE_DEFAULT_RANGE_DAYS).toBe(30);
  });
});

describe('listProviders', () => {
  it('lists the five MVP providers', () => {
    const provs = listProviders();
    expect(provs).toContain('anthropic');
    expect(provs).toContain('openai');
    expect(provs).toContain('google');
    expect(provs).toContain('mistral');
    expect(provs).toContain('cohere');
    expect(provs).toHaveLength(5);
  });
});
