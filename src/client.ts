import { HttpExecutor, type ExecuteOptions, type RetryOptions } from './http';
import { iteratePages, type WrappedListResponse } from './pagination';
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
}

const DEFAULT_API_URL = 'https://api.superops.ai/msp';

/**
 * Options shared by every typed method: `query` swaps the field selection (the response
 * envelope shape — e.g. `{ items, listInfo }` vs bare array — must stay the same), and the
 * method's own generic type parameter lets you type the result to match. Useful when the
 * built-in field set is wider or narrower than what your app actually needs.
 */
interface CallOpts {
  errorPolicy?: ExecuteOptions['errorPolicy'];
  query?: string;
}

/**
 * Wraps SuperOps' GraphQL API. This client does not cache, if you need to and want the sdk to handle- 
 * import `CacheService`/`MemoryCacheStore` and wrap whichever calls make sense for your app, e.g.
 * `cache.getOrSet('superops:clients', () => toArray(superops.iterateClients()))`.
 */
export class SuperOpsClient {
  private readonly http: HttpExecutor;

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
  }

  /** Escape hatch for any operation not yet wrapped below — bring your own query/mutation string. */
  query<T>(gql: string, variables?: Record<string, unknown>, options?: ExecuteOptions): Promise<T> {
    return this.http.execute<T>(gql, variables, options);
  }

  // ---- Clients ----------------------------------------------------------

  async *iterateClients<T = Client>(
    input?: ListInfoInput,
    opts: CallOpts = {},
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

  async getClient<T = Client>(accountId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClient: T }>(
      opts.query ?? GQL.GET_CLIENT,
      { input: { accountId } },
      { errorPolicy: opts.errorPolicy },
    );
    return res.getClient;
  }

  // ---- Contracts ----------------------------------------------------------

  async *iterateClientContracts<T = ClientContract>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getClientContractList: { contracts: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_CLIENT_CONTRACT_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy },
      );
      return { items: res.getClientContractList.contracts, listInfo: res.getClientContractList.listInfo };
    });
  }

  async updateClientContract<T = ClientContract>(
    input: Record<string, unknown>,
    opts: CallOpts = {},
  ): Promise<T> {
    const res = await this.http.execute<{ updateClientContract: T }>(
      opts.query ?? GQL.UPDATE_CLIENT_CONTRACT,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    return res.updateClientContract;
  }

  // ---- Worklogs ----------------------------------------------------------

  async *iterateWorklogEntries<T = WorklogEntry>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getWorklogEntries: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_WORKLOG_ENTRIES,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy },
      );
      return res.getWorklogEntries;
    });
  }

  // ---- Service catalog ----------------------------------------------------

  async *iterateServiceCatalogItems<T = ServiceCatalogItem>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getServiceCatalogItemList: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_SERVICE_CATALOG_ITEM_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy },
      );
      return res.getServiceCatalogItemList;
    });
  }

  async createServiceCatalogItem<T = ServiceCatalogItem>(
    input: CreateServiceCatalogItemInput,
    opts: CallOpts = {},
  ): Promise<T> {
    const res = await this.http.execute<{ createServiceCatalogItem: T }>(
      opts.query ?? GQL.CREATE_SERVICE_CATALOG_ITEM,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    return res.createServiceCatalogItem;
  }

  /** Bare array, no pagination — SuperOps has no `input`/`listInfo` for this one, so it's a plain fetch. */
  async listServiceCategories<T = ServiceCategory>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getServiceCategoryList: T[] }>(
      opts.query ?? GQL.GET_SERVICE_CATEGORY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy },
    );
    return res.getServiceCategoryList;
  }

  // ---- Invoices ------------------------------------------------------------

  async *iterateInvoices<T = Invoice>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getInvoiceList: { invoices: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_INVOICE_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy },
      );
      return { items: res.getInvoiceList.invoices, listInfo: res.getInvoiceList.listInfo };
    });
  }

  async getInvoice<T = Invoice>(id: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getInvoice: T }>(
      opts.query ?? GQL.GET_INVOICE,
      { input: { id } },
      { errorPolicy: opts.errorPolicy },
    );
    return res.getInvoice;
  }

  async createInvoice<T = Invoice>(input: CreateInvoiceInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createInvoice: T }>(
      opts.query ?? GQL.CREATE_INVOICE,
      { input },
      { errorPolicy: opts.errorPolicy },
    );
    return res.createInvoice;
  }
}

export function createSuperOpsClient(config: SuperOpsClientConfig): SuperOpsClient {
  return new SuperOpsClient(config);
}
