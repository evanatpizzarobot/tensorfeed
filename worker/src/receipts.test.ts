import { describe, it, expect } from 'vitest';
import {
  canonicalJSON,
  hashRequest,
  hashResponse,
  tokenShort,
  generateReceiptId,
} from './receipts';

describe('canonicalJSON', () => {
  it('serializes primitives the same as JSON.stringify', () => {
    expect(canonicalJSON('hello')).toBe('"hello"');
    expect(canonicalJSON(42)).toBe('42');
    expect(canonicalJSON(true)).toBe('true');
    expect(canonicalJSON(false)).toBe('false');
    expect(canonicalJSON(null)).toBe('null');
  });

  it('sorts object keys lexicographically', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJSON({ z: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"z":1}');
  });

  it('preserves array order (signing-relevant)', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });

  it('produces identical output regardless of key insertion order', () => {
    const a = canonicalJSON({ x: 1, y: 2, z: { c: 3, a: 4, b: 5 } });
    const b = canonicalJSON({ z: { b: 5, a: 4, c: 3 }, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('handles nested objects with consistent ordering', () => {
    const r = canonicalJSON({
      v: 1,
      id: 'rcpt_abc',
      method: 'GET',
      endpoint: '/api/test',
      credits_charged: 1,
    });
    expect(r).toBe('{"credits_charged":1,"endpoint":"/api/test","id":"rcpt_abc","method":"GET","v":1}');
  });

  it('escapes special characters per JSON spec', () => {
    expect(canonicalJSON('hello\nworld')).toBe('"hello\\nworld"');
    expect(canonicalJSON('quote"here')).toBe('"quote\\"here"');
  });

  it('throws on non-finite numbers', () => {
    expect(() => canonicalJSON(NaN)).toThrow(/non-finite/);
    expect(() => canonicalJSON(Infinity)).toThrow(/non-finite/);
  });

  it('throws on undefined or function', () => {
    expect(() => canonicalJSON(undefined)).toThrow();
    expect(() => canonicalJSON(() => 1)).toThrow();
  });
});

describe('hashRequest', () => {
  it('produces deterministic sha256 hex', async () => {
    const url = new URL('https://tensorfeed.ai/api/premium/routing?task=code&top_n=3');
    const h1 = await hashRequest('GET', url);
    const h2 = await hashRequest('GET', url);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('sorts query params so order does not affect the hash', async () => {
    const u1 = new URL('https://x.test/api/x?b=2&a=1');
    const u2 = new URL('https://x.test/api/x?a=1&b=2');
    expect(await hashRequest('GET', u1)).toBe(await hashRequest('GET', u2));
  });

  it('includes method in the canonical form', async () => {
    const url = new URL('https://x.test/api/x');
    const get = await hashRequest('GET', url);
    const post = await hashRequest('POST', url);
    expect(get).not.toBe(post);
  });

  it('treats methods case-insensitively', async () => {
    const url = new URL('https://x.test/api/x');
    expect(await hashRequest('get', url)).toBe(await hashRequest('GET', url));
  });
});

describe('hashResponse', () => {
  it('hashes objects via canonical-JSON', async () => {
    const a = await hashResponse({ a: 1, b: 2 });
    const b = await hashResponse({ b: 2, a: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('produces different hashes for different content', async () => {
    const a = await hashResponse({ a: 1 });
    const b = await hashResponse({ a: 2 });
    expect(a).not.toBe(b);
  });
});

describe('tokenShort', () => {
  it('shortens tf_live_ tokens to first 8 + last 8 hex', () => {
    const token = 'tf_live_' + 'a'.repeat(8) + 'b'.repeat(48) + 'c'.repeat(8);
    const short = tokenShort(token);
    expect(short).toBe('tf_live_aaaaaaaa...cccccccc');
  });

  it('passes through short or non-tf tokens with light truncation', () => {
    expect(tokenShort('short')).toBe('short');
    // Non-tf-prefix tokens use first 8 + ... + last 4 of the input
    expect(tokenShort('different_format_xxxxxxxxxx')).toMatch(/^differen\.\.\./);
  });
});

describe('generateReceiptId', () => {
  it('returns rcpt_<16hex>', () => {
    const id = generateReceiptId();
    expect(id).toMatch(/^rcpt_[0-9a-f]{16}$/);
  });

  it('produces unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateReceiptId());
    expect(ids.size).toBe(100);
  });
});
