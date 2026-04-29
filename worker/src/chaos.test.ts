import { describe, it, expect } from 'vitest';
import { maybeSimulatedErrorResponse, applySimulatedLatency, CHAOS_LIMITS } from './chaos';

function req(headers: Record<string, string> = {}, url = 'https://tensorfeed.ai/api/news'): Request {
  return new Request(url, { headers });
}

describe('maybeSimulatedErrorResponse', () => {
  it('returns null when the simulate-error header is absent', () => {
    expect(maybeSimulatedErrorResponse(req())).toBeNull();
  });

  it('returns the requested status code when the header is set', async () => {
    const res = maybeSimulatedErrorResponse(req({ 'X-TensorFeed-Simulate-Error': '503' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    expect(res!.headers.get('X-TensorFeed-Simulated')).toBe('true');
    const body = await res!.json() as { error: string; simulated: boolean; status: number };
    expect(body.error).toBe('simulated_error');
    expect(body.simulated).toBe(true);
    expect(body.status).toBe(503);
  });

  it('handles 4xx codes too', async () => {
    const res = maybeSimulatedErrorResponse(req({ 'X-TensorFeed-Simulate-Error': '429' }));
    expect(res!.status).toBe(429);
    const body = await res!.json() as { status: number };
    expect(body.status).toBe(429);
  });

  it('rejects sub-400 codes as 400 with a hint', async () => {
    const res = maybeSimulatedErrorResponse(req({ 'X-TensorFeed-Simulate-Error': '200' }));
    expect(res!.status).toBe(400);
    const body = await res!.json() as { error: string; hint: string };
    expect(body.hint).toContain('503');
  });

  it('rejects super-599 codes as 400', () => {
    const res = maybeSimulatedErrorResponse(req({ 'X-TensorFeed-Simulate-Error': '700' }));
    expect(res!.status).toBe(400);
  });

  it('rejects non-numeric input as 400', () => {
    const res = maybeSimulatedErrorResponse(req({ 'X-TensorFeed-Simulate-Error': 'panic' }));
    expect(res!.status).toBe(400);
  });
});

describe('applySimulatedLatency', () => {
  it('returns 0 when no header is set', async () => {
    const ms = await applySimulatedLatency(req());
    expect(ms).toBe(0);
  });

  it('actually waits the requested duration', async () => {
    const start = Date.now();
    const ms = await applySimulatedLatency(req({ 'X-TensorFeed-Simulate-Latency': '50' }));
    const elapsed = Date.now() - start;
    expect(ms).toBe(50);
    // Real sleep, so allow a tolerance for slow CI but reject obvious no-ops
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it('caps absurdly large values at MAX_LATENCY_MS', async () => {
    // Stub setTimeout so we don't actually sleep MAX_LATENCY_MS during the test
    const realSetTimeout = globalThis.setTimeout;
    let observedDelay = -1;
    globalThis.setTimeout = ((cb: () => void, delay: number) => {
      observedDelay = delay;
      return realSetTimeout(cb, 0);
    }) as typeof setTimeout;
    try {
      const ms = await applySimulatedLatency(req({ 'X-TensorFeed-Simulate-Latency': '999999999' }));
      expect(ms).toBe(CHAOS_LIMITS.MAX_LATENCY_MS);
      expect(observedDelay).toBe(CHAOS_LIMITS.MAX_LATENCY_MS);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });

  it('ignores zero and negative values', async () => {
    expect(await applySimulatedLatency(req({ 'X-TensorFeed-Simulate-Latency': '0' }))).toBe(0);
    expect(await applySimulatedLatency(req({ 'X-TensorFeed-Simulate-Latency': '-100' }))).toBe(0);
  });

  it('ignores non-numeric values', async () => {
    expect(await applySimulatedLatency(req({ 'X-TensorFeed-Simulate-Latency': 'forever' }))).toBe(0);
  });
});
