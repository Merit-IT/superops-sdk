import { HttpExecutor, type ExecuteOptions, type RetryOptions } from './http';
import { CacheService, type CacheOptions } from './cache';
import { fetchAllPages, iteratePages, type WrappedListResponse } from './pagination';
import type { ListInfoInput } from './types/common';
import type {
  Client,
  ClientContract,
  WorklogEntry,
  ServiceCatalogItem,
  ServiceCategory,
  CreateInvoiceInput,
  Invoice,
  CreateServiceCatalogItemInput,
} from './types/entities';
import * as GQL from './gql/operations';

export interface AuthResolver {
  (): { apiKey: string; subdomain: string };
}

export interface SuperOpsClientConfig {
  apiUrl?: string;
  /**
   * Fixed single-tenant credentials (most consumers: one bearer token per deployment).
   * Mutually exclusive with `resolveAuth`.
   */
  apiKey?: string;
  subdomain?: string;
  /**
   * Per-request credential resolver for multi-tenant deployments (e.g. an MCP server serving
   * many API keys). Mutually exclusive with `apiKey`/`subdomain`.
   */
  resolveAuth?: AuthResolver;
  retry?: RetryOptions;
  timeoutMs?: number;
  defaultErrorPolicy?: 'throw' | 'tolerant';
  cache?: CacheOptions | false;
}

const DEFAULT_API_URL = 'https://api.superops.ai/msp';

/**
 * Options shared by every typed list/get method: `query` swaps the field selection (the
 * response envelope shape — e.g. `{ items, listInfo }` vs bare array — must stay the same),
 * and the method's own generic type parameter lets you type the result to match. Useful when
 * the built-in field set is wider or narrower than what your app actually needs.
 */
interface ReadOpts {
  ttlMs?: number;
  errorPolicy?: ExecuteOptions['errorPolicy'];
  query?: string;
}

export class SuperOpsClient {
  private readonly http: HttpExecutor;
  private readonly cache: CacheService | null;

  constructor(config: SuperOpsClientConfig) {
    const getAuth: AuthResolver =
      config.resolveAuth ??
      (() => {
        if (!config.apiKey || !config.subdomain) {
          throw new Error(
            'SuperOpsClient requires either { apiKey, subdomain } or a resolveAuth() function.',
          );
        }
        return { apiKey: config.apiKey, subdomain: config.subdomain };
      });

    this.http = new HttpExecutor({
      apiUrl: config.apiUrl ?? DEFAULT_API_URL,
      getAuth,
      retry: config.retry,
      timeoutMs: config.timeoutMs,
      defaultErrorPolicy: config.defaultErrorPolicy,
    });

    this.cache = config.cache === false ? null : new CacheService(config.cache);
  }

  /** Escape hatch for any operation not yet wrapped below — bring your own query/mutation string. */
  query<T>(gql: string, variables?: Record<string, unknown>, options?: ExecuteOptions): Promise<T> {
    return this.http.execute<T>(gql, variables, options);
  }

  private cached<T>(key: string, ttlMs: number | undefined, factory: () => Promise<T>): Promise<T> {
    if (!this.cache) return factory();
    return this.cache.getOrSet(key, factory, ttlMs);
  }

  /** Invalidate a cache entry, e.g. after a mutation that affects it. */
  invalidate(key: string): void {
    this.cache?.delete(key);
  }

  /**
   * Cache keys fold in the query string whenever it's overridden, so a custom field selection
   * never collides with (or gets served) a cache entry built from the default one.
   */
  private cacheKey(base: string, input: unknown, query?: string): string {
    return query ? `${base}:${JSON.stringify(input ?? {})}:custom:${hash(query)}` : `${base}:${JSON.stringify(input ?? {})}`;
  }

  // ---- Clients ----------------------------------------------------------

  async listClients<T = Client>(input?: ListInfoInput, opts: ReadOpts = {}): Promise<T[]> {
    const key = this.cacheKey('superops:clients', input, opts.query);
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<T>(async (page) => {
        const res = await this.http.execute<{ getClientList: { clients: T[]; listInfo: WrappedListResponse<T>['listInfo'] } }>(
          opts.query ?? GQL.GET_CLIENT_LIST,
          { input: { ...input, page } },
          { errorPolicy: opts.errorPolicy },
        );
        return { items: res.getClientList.clients, listInfo: res.getClientList.listInfo };
      }),
    );
  }

  async *iterateClients<T = Client>(
    input?: ListInfoInput,
    opts: Pick<ReadOpts, 'errorPolicy' | 'query'> = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{ getClientList: { clients: T[]; listInfo: WrappedListResponse<T>['listInfo'] } }>(
        opts.query ?? GQL.GET_CLIENT_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy },
      );
      return { items: res.getClientList.clients, listInfo: res.getClientList.listInfo };
    });
  }

  async getClient<T = Client>(
    accountId: string,
    opts: Pick<ReadOpts, 'errorPolicy' | 'query'> = {},
  ): Promise<T> {
    const key = this.cacheKey('superops:client', accountId, opts.query);
    return this.cached(key, undefined, async () => {
      const res = await this.http.execute<{ getClient: T }>(
        opts.query ?? GQL.GET_CLIENT,
        { input: { accountId } },
        { errorPolicy: opts.errorPolicy },
      );
      return res.getClient;
    });
  }

  // ---- Contracts ----------------------------------------------------------

  async listClientContracts<T = ClientContract>(
    input?: ListInfoInput,
    opts: ReadOpts = {},
  ): Promise<T[]> {
    const key = this.cacheKey('superops:contracts', input, opts.query);
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<T>(async (page) => {
        const res = await this.http.execute<{
          getClientContractList: { contracts: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
        }>(
          opts.query ?? GQL.GET_CLIENT_CONTRACT_LIST,
          { input: { ...input, page } },
          { errorPolicy: opts.errorPolicy },
        );
        return { items: res.getClientContractList.contracts, listInfo: res.getClientContractList.listInfo };
      }),
    );
  }

  async updateClientContract<T = ClientContract>(
    input: Record<string, unknown>,
    opts: { errorPolicy?: ExecuteOptions['errorPolicy']; query?: string } = {},
  ): Promise<T> {
    const res = await this.http.execute<{ updateClientContract: T }>(
      opts.query ?? GQL.UPDATE_CLIENT_CONTRACT,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    this.invalidate('superops:contracts:{}');
    return res.updateClientContract;
  }

  // ---- Worklogs ----------------------------------------------------------

  async listWorklogEntries<T = WorklogEntry>(
    input?: ListInfoInput,
    opts: ReadOpts = {},
  ): Promise<T[]> {
    const key = this.cacheKey('superops:worklogs', input, opts.query);
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<T>(async (page) => {
        const res = await this.http.execute<{
          getWorklogEntries: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
        }>(
          opts.query ?? GQL.GET_WORKLOG_ENTRIES,
          { input: { ...input, page } },
          { errorPolicy: opts.errorPolicy },
        );
        return res.getWorklogEntries;
      }),
    );
  }

  // ---- Service catalog ----------------------------------------------------

  async listServiceCatalogItems<T = ServiceCatalogItem>(
    input?: ListInfoInput,
    opts: ReadOpts = {},
  ): Promise<T[]> {
    const key = this.cacheKey('superops:catalog', input, opts.query);
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<T>(async (page) => {
        const res = await this.http.execute<{
          getServiceCatalogItemList: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
        }>(
          opts.query ?? GQL.GET_SERVICE_CATALOG_ITEM_LIST,
          { input: { ...input, page } },
          { errorPolicy: opts.errorPolicy },
        );
        return res.getServiceCatalogItemList;
      }),
    );
  }

  async createServiceCatalogItem<T = ServiceCatalogItem>(
    input: CreateServiceCatalogItemInput,
    opts: { errorPolicy?: ExecuteOptions['errorPolicy']; query?: string } = {},
  ): Promise<T> {
    const res = await this.http.execute<{ createServiceCatalogItem: T }>(
      opts.query ?? GQL.CREATE_SERVICE_CATALOG_ITEM,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    this.invalidate('superops:catalog:{}');
    return res.createServiceCatalogItem;
  }

  /** Bare array, no pagination — SuperOps has no `input`/`listInfo` for this one. */
  async listServiceCategories<T = ServiceCategory>(opts: ReadOpts = {}): Promise<T[]> {
    const key = this.cacheKey('superops:categories', undefined, opts.query);
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<T>(
        async () => {
          const res = await this.http.execute<{ getServiceCategoryList: T[] }>(
            opts.query ?? GQL.GET_SERVICE_CATEGORY_LIST,
            undefined,
            { errorPolicy: opts.errorPolicy },
          );
          return res.getServiceCategoryList;
        },
        { paginated: false },
      ),
    );
  }

  // ---- Invoices ------------------------------------------------------------

  async createInvoice<T = Invoice>(
    input: CreateInvoiceInput,
    opts: { errorPolicy?: ExecuteOptions['errorPolicy']; query?: string } = {},
  ): Promise<T> {
    const res = await this.http.execute<{ createInvoice: T }>(
      opts.query ?? GQL.CREATE_INVOICE,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    return res.createInvoice;
  }
}

/** Small, fast, non-cryptographic string hash — just needs to disambiguate cache keys. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function createSuperOpsClient(config: SuperOpsClientConfig): SuperOpsClient {
  return new SuperOpsClient(config);
}
