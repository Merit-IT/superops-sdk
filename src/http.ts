export interface GraphQLError {
  message: string;
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export class SuperOpsGraphQLError extends Error {
  constructor(
    message: string,
    public readonly errors: GraphQLError[],
    public readonly data: unknown,
  ) {
    super(message);
    this.name = 'SuperOpsGraphQLError';
  }
}

export interface RetryOptions {
  /** Max attempts including the first try. Default 4. */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default 300. */
  baseDelayMs?: number;
  /** Max delay in ms, before jitter. Default 8000. */
  maxDelayMs?: number;
}

export interface HttpExecutorOptions {
  apiUrl: string;
  /** Resolved per-call so a single client instance can serve multiple tenants/keys. */
  getAuth: () => { apiKey: string; subdomain: string };
  /** Request timeout in ms. Default 30000. */
  timeoutMs?: number;
  retry?: RetryOptions;
  /**
   * Default GraphQL error policy for calls that don't override it:
   * 'throw' (default) rejects when `errors[]` is present, even if `data` is also present.
   * 'tolerant' returns `data` and ignores `errors[]` as long as `data` is non-null (matches
   * the behavior consumers had converged on for read paths that can return partial results).
   */
  defaultErrorPolicy?: 'throw' | 'tolerant';
}

export interface ExecuteOptions {
  errorPolicy?: 'throw' | 'tolerant';
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, opts: Required<RetryOptions>): number {
  const exp = Math.min(opts.baseDelayMs * 2 ** attempt, opts.maxDelayMs);
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

export class HttpExecutor {
  private readonly retry: Required<RetryOptions>;
  private readonly timeoutMs: number;
  private readonly defaultErrorPolicy: 'throw' | 'tolerant';

  constructor(private readonly opts: HttpExecutorOptions) {
    this.retry = {
      maxAttempts: opts.retry?.maxAttempts ?? 4,
      baseDelayMs: opts.retry?.baseDelayMs ?? 300,
      maxDelayMs: opts.retry?.maxDelayMs ?? 8000,
    };
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.defaultErrorPolicy = opts.defaultErrorPolicy ?? 'throw';
  }

  async execute<T>(
    query: string,
    variables?: Record<string, unknown>,
    options: ExecuteOptions = {},
  ): Promise<T> {
    const errorPolicy = options.errorPolicy ?? this.defaultErrorPolicy;
    let lastError: unknown;

    for (let attempt = 0; attempt < this.retry.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const signal = options.signal
        ? mergeSignals(options.signal, controller.signal)
        : controller.signal;

      try {
        const { apiKey, subdomain } = this.opts.getAuth();
        const res = await fetch(this.opts.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            CustomerSubDomain: subdomain,
          },
          body: JSON.stringify({ query, variables }),
          signal,
        });

        if (RETRYABLE_STATUS.has(res.status) && attempt < this.retry.maxAttempts - 1) {
          const retryAfter = res.headers.get('retry-after');
          const delay = retryAfter
            ? Number(retryAfter) * 1000
            : backoffDelay(attempt, this.retry);
          await sleep(delay);
          continue;
        }

        if (!res.ok) {
          throw new Error(`SuperOps API request failed: ${res.status} ${res.statusText}`);
        }

        const body = (await res.json()) as GraphQLResponse<T>;

        if (body.errors?.length) {
          if (errorPolicy === 'tolerant' && body.data != null) {
            return body.data;
          }
          throw new SuperOpsGraphQLError(
            body.errors.map((e) => e.message).join('; '),
            body.errors,
            body.data,
          );
        }

        return body.data as T;
      } catch (err) {
        lastError = err;
        if (err instanceof SuperOpsGraphQLError) throw err;
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (attempt < this.retry.maxAttempts - 1 && (isAbort || isNetworkError(err))) {
          await sleep(backoffDelay(attempt, this.retry));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  }
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}
