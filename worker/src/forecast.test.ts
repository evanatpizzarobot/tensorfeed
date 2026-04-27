/**
 * Pure-logic unit tests for premium forecast.
 *
 * Tests the linear-regression core, confidence scoring, history
 * extraction from KV snapshots, and validation. Statistical correctness
 * is verified against hand-computed expected values for small inputs.
 */

import { describe, it, expect } from 'vitest';
import { computeForecast } from './forecast';
import type { Env } from './types';

interface MockKV {
  get: (key: string, type?: string) => Promise<unknown>;
  put: () => Promise<void>;
  delete: () => Promise<void>;
  list: () => Promise<{ keys: { name: string }[] }>;
}

function makeKV(initial: Record<string, unknown>): MockKV {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async () => undefined,
    delete: async () => undefined,
    list: async () => ({ keys: [] }),
  };
}

function makeEnv(seed: Record<string, unknown> = {}): Env {
  return {
    TENSORFEED_NEWS: makeKV({}) as unknown as KVNamespace,
    TENSORFEED_STATUS: makeKV({}) as unknown as KVNamespace,
    TENSORFEED_CACHE: makeKV(seed) as unknown as KVNamespace,
    ENVIRONMENT: 'test',
    SITE_URL: 'https://tensorfeed.ai',
    INDEXNOW_KEY: '',
    X_API_KEY: '',
    X_API_SECRET: '',
    X_ACCESS_TOKEN: '',
    X_ACCESS_SECRET: '',
    GITHUB_TOKEN: '',
    RESEND_API_KEY: '',
    ALERT_EMAIL_TO: '',
    ALERT_EMAIL_FROM: '',
    PAYMENT_WALLET: '0x0',
    PAYMENT_ENABLED: 'true',
  };
}

function pricingSnapshot(date: string, modelName: string, input: number, output: number) {
  return {
    date,
    type: 'models',
    capturedAt: `${date}T07:00:00.000Z`,
    data: {
      providers: [
        { id: 'anthropic', name: 'Anthropic', models: [{ id: 'opus-4-7', name: modelName, inputPrice: input, outputPrice: output }] },
      ],
    },
  };
}

function benchmarkSnapshot(date: string, modelName: string, score: number) {
  return {
    date,
    type: 'benchmarks',
    capturedAt: `${date}T07:00:00.000Z`,
    data: {
      models: [
        { model: modelName, provider: 'Anthropic', scores: { swe_bench: score } },
      ],
    },
  };
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Validation tests ────────────────────────────────────────────────

describe('computeForecast: validation', () => {
  it('rejects invalid target', async () => {
    const env = makeEnv();
    const r = await computeForecast(env, {
      target: 'unknown' as never,
      model: 'X',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('invalid_target');
  });

  it('rejects empty model', async () => {
    const env = makeEnv();
    const r = await computeForecast(env, { target: 'price', model: '' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('model_required');
  });

  it('rejects price target without field', async () => {
    const env = makeEnv();
    const r = await computeForecast(env, { target: 'price', model: 'X' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('price_field_required');
  });

  it('rejects benchmark target without benchmark name', async () => {
    const env = makeEnv();
    const r = await computeForecast(env, { target: 'benchmark', model: 'X' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('benchmark_required');
  });
});

// ── Insufficient data ───────────────────────────────────────────────

describe('computeForecast: insufficient history', () => {
  it('returns insufficient_history when < 4 data points', async () => {
    const today = todayUTC();
    const seed: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) {
      const date = addDays(today, -i);
      seed[`history:${date}:models`] = pricingSnapshot(date, 'Opus 4.7', 15, 75);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'blended',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('insufficient_history');
  });

  it('returns insufficient_history when no snapshots at all', async () => {
    const env = makeEnv();
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'blended',
    });
    expect(r.ok).toBe(false);
  });
});

// ── Linear fit on a clean trend ─────────────────────────────────────

describe('computeForecast: clean linear trend', () => {
  it('extrapolates a perfect linear price drop with high confidence', async () => {
    const today = todayUTC();
    // 10 points: input price drops from $20 to $11 (1 per day)
    const seed: Record<string, unknown> = {};
    for (let i = 9; i >= 0; i--) {
      const date = addDays(today, -i);
      const input = 11 + i; // newest = 11, oldest = 20
      seed[`history:${date}:models`] = pricingSnapshot(date, 'Opus 4.7', input, input * 5);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'inputPrice',
      lookback: 30,
      horizon: 5,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fitted_on.data_points).toBe(10);
    expect(r.current_value).toBe(11);
    expect(r.trend.slope_per_day).toBeCloseTo(-1, 4);
    expect(r.trend.r_squared).toBeCloseTo(1, 4);
    expect(r.confidence.label).toBe('low'); // 10 points still penalized by sample size
    expect(r.forecast).toHaveLength(5);
    // Day 1 forward should be ~10
    expect(r.forecast[0].predicted).toBeCloseTo(10, 4);
    // Day 5 forward should be ~6
    expect(r.forecast[4].predicted).toBeCloseTo(6, 4);
  });

  it('flat history produces flat forecast near current value', async () => {
    const today = todayUTC();
    const seed: Record<string, unknown> = {};
    for (let i = 14; i >= 0; i--) {
      const date = addDays(today, -i);
      seed[`history:${date}:models`] = pricingSnapshot(date, 'Opus 4.7', 15, 75);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'blended',
      horizon: 7,
    });
    if (!r.ok) return;
    expect(r.trend.slope_per_day).toBeCloseTo(0, 4);
    expect(r.forecast.every(p => Math.abs(p.predicted - 45) < 0.001)).toBe(true);
  });

  it('higher confidence with more data points and clean signal', async () => {
    const today = todayUTC();
    const seed: Record<string, unknown> = {};
    // 30 points of perfectly linear trend
    for (let i = 29; i >= 0; i--) {
      const date = addDays(today, -i);
      const input = 30 - i * 0.5;
      seed[`history:${date}:models`] = pricingSnapshot(date, 'Opus 4.7', input, input * 5);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'inputPrice',
      lookback: 30,
    });
    if (!r.ok) return;
    expect(r.confidence.label).toBe('high');
    expect(r.confidence.score).toBeGreaterThanOrEqual(0.9);
  });
});

// ── Benchmark forecast ──────────────────────────────────────────────

describe('computeForecast: benchmark target', () => {
  it('forecasts a benchmark score series', async () => {
    const today = todayUTC();
    const seed: Record<string, unknown> = {};
    for (let i = 9; i >= 0; i--) {
      const date = addDays(today, -i);
      const score = 70 + (9 - i) * 0.3; // slowly rising
      seed[`history:${date}:benchmarks`] = benchmarkSnapshot(date, 'Opus 4.7', score);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'benchmark',
      model: 'Opus 4.7',
      benchmark: 'swe_bench',
      horizon: 5,
    });
    if (!r.ok) return;
    expect(r.target).toBe('benchmark');
    expect(r.benchmark).toBe('swe_bench');
    expect(r.trend.slope_per_day).toBeCloseTo(0.3, 4);
    expect(r.forecast).toHaveLength(5);
  });
});

// ── Confidence interval ─────────────────────────────────────────────

describe('computeForecast: confidence interval', () => {
  it('generates a 95% prediction interval that brackets the predicted value', async () => {
    const today = todayUTC();
    const seed: Record<string, unknown> = {};
    // Noisy trend: linear baseline with random-ish variation
    const baseline = [15, 16, 14, 17, 13, 16, 15, 18, 14, 17];
    for (let i = 0; i < baseline.length; i++) {
      const date = addDays(today, -(baseline.length - 1 - i));
      seed[`history:${date}:models`] = pricingSnapshot(date, 'Opus 4.7', baseline[i], baseline[i] * 5);
    }
    const env = makeEnv(seed);
    const r = await computeForecast(env, {
      target: 'price',
      model: 'Opus 4.7',
      field: 'inputPrice',
    });
    if (!r.ok) return;
    for (const point of r.forecast) {
      expect(point.lower).toBeLessThanOrEqual(point.predicted);
      expect(point.upper).toBeGreaterThanOrEqual(point.predicted);
      // Interval should be non-trivial given noisy data
      expect(point.upper - point.lower).toBeGreaterThan(0);
    }
  });
});
