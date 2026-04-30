import { describe, it, expect } from 'vitest';
import {
  normalizeGPUName,
  summarizeOffers,
  pickCheapest,
  resolveRange,
  isCanonicalGPU,
  CANONICAL_VRAM,
  GPU_MAX_RANGE_DAYS,
  GPU_DEFAULT_RANGE_DAYS,
  GPUOffer,
  PricingSnapshot,
} from './gpu-pricing';

describe('normalizeGPUName', () => {
  it('matches H200 before H100 (H200 is more specific)', () => {
    expect(normalizeGPUName('NVIDIA H200 SXM5').canonical).toBe('H200');
    expect(normalizeGPUName('H100 80GB SXM5').canonical).toBe('H100');
  });

  it('separates A100 80GB from A100 40GB', () => {
    expect(normalizeGPUName('A100 80GB SXM4').canonical).toBe('A100-80GB');
    expect(normalizeGPUName('A100 40GB PCIe').canonical).toBe('A100-40GB');
    expect(normalizeGPUName('A100', 80).canonical).toBe('A100-80GB');
    expect(normalizeGPUName('A100', 40).canonical).toBe('A100-40GB');
  });

  it('defaults A100 without VRAM hint to 40GB', () => {
    expect(normalizeGPUName('A100').canonical).toBe('A100-40GB');
  });

  it('separates L40S from L40 from L4', () => {
    expect(normalizeGPUName('L40S 48GB').canonical).toBe('L40S');
    expect(normalizeGPUName('NVIDIA L40').canonical).toBe('L40');
    expect(normalizeGPUName('L4').canonical).toBe('L4');
  });

  it('matches RTX 6000 Ada variants', () => {
    expect(normalizeGPUName('RTX 6000 Ada').canonical).toBe('RTX-6000-Ada');
    expect(normalizeGPUName('RTX-6000-Ada').canonical).toBe('RTX-6000-Ada');
    expect(normalizeGPUName('RTX A6000').canonical).toBe('A6000');
  });

  it('matches consumer cards', () => {
    expect(normalizeGPUName('GeForce RTX 4090').canonical).toBe('RTX-4090');
    expect(normalizeGPUName('GeForce RTX 3090').canonical).toBe('RTX-3090');
  });

  it('matches AMD MI300X and MI250', () => {
    expect(normalizeGPUName('AMD Instinct MI300X').canonical).toBe('MI300X');
    expect(normalizeGPUName('MI250').canonical).toBe('MI250');
  });

  it('returns OTHER for unknown', () => {
    expect(normalizeGPUName('Some Future GPU 9001').canonical).toBe('OTHER');
    expect(normalizeGPUName('').canonical).toBe('OTHER');
  });

  it('preserves VRAM hint when canonical is OTHER', () => {
    expect(normalizeGPUName('Future GPU', 256)).toEqual({ canonical: 'OTHER', vram_gb: 256 });
  });
});

describe('summarizeOffers', () => {
  const mkOffer = (provider: string, gpu: string, on_demand: number | null, spot: number | null = null): GPUOffer => {
    const norm = normalizeGPUName(gpu);
    return {
      provider,
      gpu_raw: gpu,
      gpu_canonical: norm.canonical,
      vram_gb: norm.vram_gb,
      on_demand_usd_hr: on_demand,
      spot_usd_hr: spot,
      available_count: 1,
      region: null,
      source_url: 'https://example.com',
      last_seen: '2026-04-29T00:00:00Z',
    };
  };

  it('groups by canonical and picks cheapest on-demand and spot', () => {
    const offers = [
      mkOffer('vast', 'H100 80GB SXM5', 2.5, 1.8),
      mkOffer('runpod', 'H100', 2.0, 2.1),
      mkOffer('vast', 'H100', 2.3, null),
    ];
    const summary = summarizeOffers(offers);
    const h100 = summary.find(s => s.canonical === 'H100');
    expect(h100).toBeDefined();
    expect(h100!.cheapest_on_demand?.provider).toBe('runpod');
    expect(h100!.cheapest_on_demand?.usd_hr).toBe(2.0);
    expect(h100!.cheapest_spot?.provider).toBe('vast');
    expect(h100!.cheapest_spot?.usd_hr).toBe(1.8);
    expect(h100!.provider_count).toBe(2);
    expect(h100!.total_offers).toBe(3);
  });

  it('handles GPUs with only spot or only on-demand pricing', () => {
    const offers = [
      mkOffer('vast', 'A100 80GB', null, 0.9),
      mkOffer('runpod', 'A100 80GB', 1.5, null),
    ];
    const summary = summarizeOffers(offers);
    const a100 = summary.find(s => s.canonical === 'A100-80GB');
    expect(a100!.cheapest_on_demand?.provider).toBe('runpod');
    expect(a100!.cheapest_spot?.provider).toBe('vast');
  });

  it('orders by VRAM desc with OTHER last', () => {
    const offers = [
      mkOffer('vast', 'L4', 0.3),
      mkOffer('runpod', 'H100', 2.0),
      mkOffer('vast', 'mystery card', 5.0),
      mkOffer('runpod', 'H200', 4.0),
    ];
    const summary = summarizeOffers(offers);
    const order = summary.map(s => s.canonical);
    expect(order[0]).toBe('H200');
    expect(order[order.length - 1]).toBe('OTHER');
    expect(order.indexOf('H100')).toBeLessThan(order.indexOf('L4'));
  });

  it('ignores zero or negative prices when picking cheapest', () => {
    const offers = [
      mkOffer('vast', 'H100', 0, 0),
      mkOffer('runpod', 'H100', 2.0, 1.5),
    ];
    const summary = summarizeOffers(offers);
    const h100 = summary.find(s => s.canonical === 'H100');
    expect(h100!.cheapest_on_demand?.provider).toBe('runpod');
    expect(h100!.cheapest_spot?.provider).toBe('runpod');
  });
});

describe('pickCheapest', () => {
  const snapshot: PricingSnapshot = {
    capturedAt: '2026-04-29T00:00:00Z',
    providers: ['vast', 'runpod'],
    offers: [
      { provider: 'vast', gpu_raw: 'H100', gpu_canonical: 'H100', vram_gb: 80, on_demand_usd_hr: 2.5, spot_usd_hr: 1.8, available_count: 1, region: 'US-East', source_url: 'https://vast.ai', last_seen: '2026-04-29T00:00:00Z' },
      { provider: 'runpod', gpu_raw: 'H100', gpu_canonical: 'H100', vram_gb: 80, on_demand_usd_hr: 2.0, spot_usd_hr: 2.1, available_count: 1, region: null, source_url: 'https://runpod.io', last_seen: '2026-04-29T00:00:00Z' },
      { provider: 'vast', gpu_raw: 'H100', gpu_canonical: 'H100', vram_gb: 80, on_demand_usd_hr: 2.3, spot_usd_hr: null, available_count: 1, region: 'EU', source_url: 'https://vast.ai', last_seen: '2026-04-29T00:00:00Z' },
    ],
    by_canonical: [],
    errors: [],
    notes: [],
  };

  it('returns top 3 cheapest on-demand', () => {
    const result = pickCheapest(snapshot, 'H100', 'on_demand');
    expect(result.results).toHaveLength(3);
    expect(result.results[0].usd_hr).toBe(2.0);
    expect(result.results[1].usd_hr).toBe(2.3);
    expect(result.results[2].usd_hr).toBe(2.5);
  });

  it('returns top spot prices, filtering offers with no spot', () => {
    const result = pickCheapest(snapshot, 'H100', 'spot');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].usd_hr).toBe(1.8);
  });

  it('returns vram_gb for canonical', () => {
    const result = pickCheapest(snapshot, 'H100', 'on_demand');
    expect(result.vram_gb).toBe(80);
  });

  it('returns empty results array when no offers match', () => {
    const result = pickCheapest(snapshot, 'B200', 'on_demand');
    expect(result.results).toEqual([]);
  });
});

describe('resolveRange', () => {
  it('defaults to a 30-day window ending today when nothing is supplied', () => {
    const r = resolveRange(null, null);
    expect(r.ok).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    expect(r.to).toBe(today);
    expect(r.from).toBeDefined();
    const from = new Date(`${r.from}T00:00:00Z`);
    const to = new Date(`${r.to}T00:00:00Z`);
    const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(days).toBe(GPU_DEFAULT_RANGE_DAYS - 1);
  });

  it('rejects malformed dates', () => {
    expect(resolveRange('not-a-date', null).ok).toBe(false);
    expect(resolveRange(null, '2026/04/29').ok).toBe(false);
  });

  it('rejects from after to', () => {
    expect(resolveRange('2026-05-01', '2026-04-29').ok).toBe(false);
  });

  it('rejects ranges over the max', () => {
    expect(resolveRange('2025-01-01', '2026-04-29').ok).toBe(false);
  });

  it('accepts an exact 90-day range', () => {
    const r = resolveRange('2026-01-30', '2026-04-29');
    expect(r.ok).toBe(true);
  });
});

describe('isCanonicalGPU', () => {
  it('accepts known canonicals', () => {
    expect(isCanonicalGPU('H100')).toBe(true);
    expect(isCanonicalGPU('A100-80GB')).toBe(true);
    expect(isCanonicalGPU('OTHER')).toBe(true);
  });
  it('rejects unknown strings', () => {
    expect(isCanonicalGPU('h100')).toBe(false);
    expect(isCanonicalGPU('A100')).toBe(false);
    expect(isCanonicalGPU('whatever')).toBe(false);
  });
});

describe('CANONICAL_VRAM completeness', () => {
  it('has VRAM for every canonical except OTHER', () => {
    expect(CANONICAL_VRAM['H100']).toBe(80);
    expect(CANONICAL_VRAM['H200']).toBe(141);
    expect(CANONICAL_VRAM['B200']).toBe(192);
    expect(CANONICAL_VRAM['MI300X']).toBe(192);
    expect(CANONICAL_VRAM['RTX-4090']).toBe(24);
  });
});

describe('limits export', () => {
  it('exposes default and max range', () => {
    expect(GPU_DEFAULT_RANGE_DAYS).toBe(30);
    expect(GPU_MAX_RANGE_DAYS).toBe(90);
  });
});
