/**
 * Pure-logic tests for the premium provider deep-dive aggregator.
 */

import { describe, it, expect } from 'vitest';
import { computeProviderDeepDive } from './provider-deepdive';
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

function makeEnv(opts: {
  pricing?: unknown;
  benchmarks?: unknown;
  services?: unknown;
  articles?: unknown;
}): Env {
  return {
    TENSORFEED_NEWS: makeKV(opts.articles !== undefined ? { articles: opts.articles } : {}) as unknown as KVNamespace,
    TENSORFEED_STATUS: makeKV(opts.services !== undefined ? { services: opts.services } : {}) as unknown as KVNamespace,
    TENSORFEED_CACHE: makeKV({
      ...(opts.pricing !== undefined ? { models: opts.pricing } : {}),
      ...(opts.benchmarks !== undefined ? { benchmarks: opts.benchmarks } : {}),
    }) as unknown as KVNamespace,
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

const PRICING = {
  lastUpdated: '2026-04-27',
  providers: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      url: 'https://anthropic.com',
      models: [
        { id: 'opus-4-7', name: 'Claude Opus 4.7', inputPrice: 15, outputPrice: 75, contextWindow: 1_000_000, tier: 'flagship', released: '2026-04-17', capabilities: ['tool-use', 'vision'] },
        { id: 'sonnet-4-6', name: 'Claude Sonnet 4.6', inputPrice: 3, outputPrice: 15, contextWindow: 200_000, tier: 'mid', released: '2026-02-10' },
        { id: 'haiku-4-5', name: 'Claude Haiku 4.5', inputPrice: 0.25, outputPrice: 1.25, contextWindow: 200_000, tier: 'budget', released: '2025-12-05' },
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI',
      url: 'https://openai.com',
      models: [
        { id: 'gpt-5-5', name: 'GPT-5.5', inputPrice: 10, outputPrice: 30, contextWindow: 256_000, tier: 'flagship' },
      ],
    },
  ],
};

const BENCHMARKS = {
  lastUpdated: '2026-04-27',
  models: [
    { model: 'Claude Opus 4.7', provider: 'Anthropic', scores: { swe_bench: 73.4, mmlu_pro: 88.5 } },
    { model: 'Claude Sonnet 4.6', provider: 'Anthropic', scores: { swe_bench: 65.0 } },
    { model: 'GPT-5.5', provider: 'OpenAI', scores: { swe_bench: 70.0 } },
  ],
};

const SERVICES = [
  { name: 'Anthropic', provider: 'anthropic', status: 'operational', statusPageUrl: 'https://status.anthropic.com', lastChecked: '2026-04-27T18:00:00Z', components: [{ name: 'API', status: 'operational' }] },
  { name: 'OpenAI', provider: 'openai', status: 'degraded', statusPageUrl: 'https://status.openai.com', lastChecked: '2026-04-27T18:00:00Z' },
];

const ARTICLES = [
  { id: '1', title: 'Anthropic ships Claude Opus 4.7', url: 'https://x', source: 'Anthropic Blog', sourceDomain: 'anthropic.com', snippet: 'New flagship model', categories: ['Anthropic', 'Models'], publishedAt: '2026-04-27T12:00:00Z' },
  { id: '2', title: 'OpenAI releases GPT-5.5', url: 'https://y', source: 'OpenAI Blog', sourceDomain: 'openai.com', snippet: 'New model', categories: ['OpenAI'], publishedAt: '2026-04-25T12:00:00Z' },
];

describe('computeProviderDeepDive', () => {
  it('returns a fully joined deep-dive for a known provider (by id)', async () => {
    const env = makeEnv({ pricing: PRICING, benchmarks: BENCHMARKS, services: SERVICES, articles: ARTICLES });
    const r = await computeProviderDeepDive(env, 'anthropic');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provider.name).toBe('Anthropic');
    expect(r.provider.url).toBe('https://anthropic.com');
    expect(r.status.state).toBe('operational');
    expect(r.status.status_page_url).toBe('https://status.anthropic.com');
    expect(r.models).toHaveLength(3);
    // Sorted with flagship first
    expect(r.models[0].tier).toBe('flagship');
    expect(r.models[0].name).toBe('Claude Opus 4.7');
    expect(r.models[1].tier).toBe('mid');
    expect(r.models[2].tier).toBe('budget');
    // Benchmark scores joined for Opus 4.7
    expect(r.models[0].benchmark_scores.swe_bench).toBe(73.4);
    expect(r.models[0].benchmark_scores.mmlu_pro).toBe(88.5);
    // Recent news matched
    expect(r.recent_news.length).toBeGreaterThan(0);
    expect(r.recent_news[0].title).toContain('Anthropic');
  });

  it('matches by display name case-insensitively', async () => {
    const env = makeEnv({ pricing: PRICING, benchmarks: BENCHMARKS, services: SERVICES, articles: ARTICLES });
    const r = await computeProviderDeepDive(env, 'ANTHROPIC');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provider.name).toBe('Anthropic');
  });

  it('returns provider_not_found with available_providers list when no match', async () => {
    const env = makeEnv({ pricing: PRICING, benchmarks: BENCHMARKS, services: SERVICES, articles: ARTICLES });
    const r = await computeProviderDeepDive(env, 'phantom-corp');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('provider_not_found');
    expect(r.available_providers).toContain('Anthropic');
    expect(r.available_providers).toContain('OpenAI');
  });

  it('reports status as unknown when no status entry matches', async () => {
    const pricingOnly = {
      providers: [
        { id: 'unknown-provider', name: 'Unknown Provider', models: [{ id: 'x', name: 'X-1', inputPrice: 1, outputPrice: 2 }] },
      ],
    };
    const env = makeEnv({ pricing: pricingOnly, services: [], articles: [], benchmarks: BENCHMARKS });
    const r = await computeProviderDeepDive(env, 'unknown-provider');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.status.state).toBe('unknown');
    expect(r.notes.some(n => n.includes('No status entry matched'))).toBe(true);
  });

  it('handles a provider with no benchmark coverage', async () => {
    const noBench = { lastUpdated: '2026-04-27', models: [] };
    const env = makeEnv({ pricing: PRICING, benchmarks: noBench, services: SERVICES, articles: ARTICLES });
    const r = await computeProviderDeepDive(env, 'anthropic');
    if (!r.ok) return;
    expect(r.models.every(m => Object.keys(m.benchmark_scores).length === 0)).toBe(true);
    expect(r.notes.some(n => n.includes('No benchmark coverage'))).toBe(true);
  });

  it('caps recent news at 8 items', async () => {
    const lots = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      title: `Anthropic announcement ${i}`,
      url: `https://x/${i}`,
      source: 'Anthropic Blog',
      sourceDomain: 'anthropic.com',
      snippet: 's',
      categories: ['Anthropic'],
      publishedAt: '2026-04-27T12:00:00Z',
    }));
    const env = makeEnv({ pricing: PRICING, benchmarks: BENCHMARKS, services: SERVICES, articles: lots });
    const r = await computeProviderDeepDive(env, 'anthropic');
    if (!r.ok) return;
    expect(r.recent_news).toHaveLength(8);
    expect(r.recent_news_count).toBe(15);
  });

  it('rejects empty provider key', async () => {
    const env = makeEnv({ pricing: PRICING });
    const r = await computeProviderDeepDive(env, '');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('provider_required');
  });
});
