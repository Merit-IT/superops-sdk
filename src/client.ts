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

  // ---- Clients ----------------------------------------------------------

  async listClients(input?: ListInfoInput, opts: { ttlMs?: number } = {}): Promise<Client[]> {
    const key = `superops:clients:${JSON.stringify(input ?? {})}`;
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<Client>(
        async (page) => {
          const res = await this.http.execute<{ getClientList: { clients: Client[]; listInfo: WrappedListResponse<Client>['listInfo'] } }>(
            GQL.GET_CLIENT_LIST,
            { input: { ...input, page } },
          );
          return { items: res.getClientList.clients, listInfo: res.getClientList.listInfo };
        },
      ),
    );
  }

  async *iterateClients(input?: ListInfoInput): AsyncGenerator<Client[], void, void> {
    yield* iteratePages<Client>(async (page) => {
      const res = await this.http.execute<{ getClientList: { clients: Client[]; listInfo: WrappedListResponse<Client>['listInfo'] } }>(
        GQL.GET_CLIENT_LIST,
        { input: { ...input, page } },
      );
      return { items: res.getClientList.clients, listInfo: res.getClientList.listInfo };
    });
  }

  async getClient(accountId: string): Promise<Client> {
    const key = `superops:client:${accountId}`;
    return this.cached(key, undefined, async () => {
      const res = await this.http.execute<{ getClient: Client }>(GQL.GET_CLIENT, {
        input: { accountId },
      });
      return res.getClient;
    });
  }

  // ---- Contracts ----------------------------------------------------------

  async listClientContracts(
    input?: ListInfoInput,
    opts: { ttlMs?: number } = {},
  ): Promise<ClientContract[]> {
    const key = `superops:contracts:${JSON.stringify(input ?? {})}`;
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<ClientContract>(async (page) => {
        const res = await this.http.execute<{
          getClientContractList: { contracts: ClientContract[]; listInfo: WrappedListResponse<ClientContract>['listInfo'] };
        }>(GQL.GET_CLIENT_CONTRACT_LIST, { input: { ...input, page } });
        return { items: res.getClientContractList.contracts, listInfo: res.getClientContractList.listInfo };
      }),
    );
  }

  async updateClientContract(input: Record<string, unknown>): Promise<ClientContract> {
    const res = await this.http.execute<{ updateClientContract: ClientContract }>(
      GQL.UPDATE_CLIENT_CONTRACT,
      { input },
    );
    this.invalidate(`superops:contracts:${JSON.stringify({})}`);
    return res.updateClientContract;
  }

  // ---- Worklogs ----------------------------------------------------------

  async listWorklogEntries(
    input?: ListInfoInput,
    opts: { ttlMs?: number } = {},
  ): Promise<WorklogEntry[]> {
    const key = `superops:worklogs:${JSON.stringify(input ?? {})}`;
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<WorklogEntry>(async (page) => {
        const res = await this.http.execute<{
          getWorklogEntries: { items: WorklogEntry[]; listInfo: WrappedListResponse<WorklogEntry>['listInfo'] };
        }>(GQL.GET_WORKLOG_ENTRIES, { input: { ...input, page } });
        return res.getWorklogEntries;
      }),
    );
  }

  // ---- Service catalog ----------------------------------------------------

  async listServiceCatalogItems(
    input?: ListInfoInput,
    opts: { ttlMs?: number } = {},
  ): Promise<ServiceCatalogItem[]> {
    const key = `superops:catalog:${JSON.stringify(input ?? {})}`;
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<ServiceCatalogItem>(async (page) => {
        const res = await this.http.execute<{
          getServiceCatalogItemList: { items: ServiceCatalogItem[]; listInfo: WrappedListResponse<ServiceCatalogItem>['listInfo'] };
        }>(GQL.GET_SERVICE_CATALOG_ITEM_LIST, { input: { ...input, page } });
        return res.getServiceCatalogItemList;
      }),
    );
  }

  async createServiceCatalogItem(input: CreateServiceCatalogItemInput): Promise<ServiceCatalogItem> {
    const res = await this.http.execute<{ createServiceCatalogItem: ServiceCatalogItem }>(
      GQL.CREATE_SERVICE_CATALOG_ITEM,
      { input },
    );
    this.invalidate(`superops:catalog:${JSON.stringify({})}`);
    return res.createServiceCatalogItem;
  }

  /** Bare array, no pagination — SuperOps has no `input`/`listInfo` for this one. */
  async listServiceCategories(opts: { ttlMs?: number } = {}): Promise<ServiceCategory[]> {
    const key = 'superops:categories';
    return this.cached(key, opts.ttlMs, () =>
      fetchAllPages<ServiceCategory>(
        async () => {
          const res = await this.http.execute<{ getServiceCategoryList: ServiceCategory[] }>(
            GQL.GET_SERVICE_CATEGORY_LIST,
          );
          return res.getServiceCategoryList;
        },
        { paginated: false },
      ),
    );
  }

  // ---- Invoices ------------------------------------------------------------

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const res = await this.http.execute<{ createInvoice: Invoice }>(GQL.CREATE_INVOICE, { input });
    return res.createInvoice;
  }
}

export function createSuperOpsClient(config: SuperOpsClientConfig): SuperOpsClient {
  return new SuperOpsClient(config);
}
