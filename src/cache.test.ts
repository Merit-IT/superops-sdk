import { describe, it, expect, vi } from 'vitest';
import { CacheService } from './cache';

describe('CacheService', () => {
  it('caches the resolved value under a key', async () => {
    const cache = new CacheService();
    const factory = vi.fn().mockResolvedValue('value');

    expect(await cache.getOrSet('k', factory)).toBe('value');
    expect(await cache.getOrSet('k', factory)).toBe('value');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent in-flight requests for the same key', async () => {
    const cache = new CacheService();
    let resolveFactory!: (v: string) => void;
    const factory = vi.fn(
      () => new Promise<string>((resolve) => (resolveFactory = resolve)),
    );

    const p1 = cache.getOrSet('k', factory);
    const p2 = cache.getOrSet('k', factory);
    resolveFactory('value');

    expect(await p1).toBe('value');
    expect(await p2).toBe('value');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('invalidates a key on delete', async () => {
    const cache = new CacheService();
    const factory = vi.fn().mockResolvedValue('value');

    await cache.getOrSet('k', factory);
    cache.delete('k');
    await cache.getOrSet('k', factory);

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('re-fetches after TTL expiry', async () => {
    vi.useFakeTimers();
    const cache = new CacheService({ defaultTtlMs: 10 });
    const factory = vi.fn().mockResolvedValue('value');

    await cache.getOrSet('k', factory);
    vi.advanceTimersByTime(11);
    await cache.getOrSet('k', factory);

    expect(factory).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
