export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** In-memory TTL store, same pattern software-audit and quoter-middleware had independently built. */
export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, Entry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export interface CacheOptions {
  store?: CacheStore;
  defaultTtlMs?: number;
}

/**
 * TTL cache with in-flight request de-duplication: concurrent callers for the same key share one
 * outstanding fetch instead of firing duplicate SuperOps requests.
 */
export class CacheService {
  private readonly store: CacheStore;
  private readonly defaultTtlMs: number;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: CacheOptions = {}) {
    this.store = options.store ?? new MemoryCacheStore();
    this.defaultTtlMs = options.defaultTtlMs ?? 300_000;
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.store.get<T>(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = factory()
      .then((value) => {
        this.store.set(key, value, ttlMs ?? this.defaultTtlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
