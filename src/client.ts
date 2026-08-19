import { HttpExecutor, type ExecuteOptions, type RetryOptions, type GraphQLError } from './http';
import { iteratePages, type WrappedListResponse } from './pagination';
import type { ListInfoInput } from './types/common';
import type {
  Client,
  ClientContract,
  ClientUser,
  ClientSite,
  CustomField,
  WorklogEntry,
  ServiceCatalogItem,
  ServiceCategory,
  CreateInvoiceInput,
  Invoice,
  InvoiceItem,
  CreateServiceCatalogItemInput,
  Ticket,
  Note,
  Technician,
  WorkStatus,
  Urgency,
  Tax,
  Category,
  SLA,
  OfferedItem,
  Task,
  ServiceItem,
  TicketConversation,
  UpdateClientContractInput,
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
  /** Client-wide default for retrying GraphQL-level execution errors — see `ExecuteOptions`. */
  defaultRetryOnGraphQLError?: (errors: GraphQLError[]) => boolean;
}

const DEFAULT_API_URL = 'https://api.superops.ai/msp';

/**
 * Options shared by every typed method: `query` swaps the field selection (the response
 * envelope shape vs bare array — must stay the same). Useful when the
 * built-in field set is wider or narrower than what your app actually needs.
 */
interface CallOpts {
  errorPolicy?: ExecuteOptions['errorPolicy'];
  query?: string;
  /** Per-call override for retrying GraphQL-level execution errors — see `ExecuteOptions`. */
  retryOnGraphQLError?: ExecuteOptions['retryOnGraphQLError'];
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
      defaultRetryOnGraphQLError: config.defaultRetryOnGraphQLError,
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
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getClientList.clients, listInfo: res.getClientList.listInfo };
    });
  }

  async getClient<T = Client>(accountId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClient: T }>(
      opts.query ?? GQL.GET_CLIENT,
      { input: { accountId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClient;
  }

  /** No `input` argument, no pagination wrapper — returns a bare array. */
  async listClientCustomFields<T = CustomField>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getClientCustomFieldList: T[] }>(
      opts.query ?? GQL.GET_CLIENT_CUSTOM_FIELD_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientCustomFieldList;
  }

  async getClientCustomField<T = CustomField>(fieldId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientCustomField: T }>(
      opts.query ?? GQL.GET_CLIENT_CUSTOM_FIELD,
      { input: { fieldId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientCustomField;
  }

  async *iterateClientUsers<T = ClientUser>(
    input?: ListInfoInput & { clientId?: string },
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    const { clientId, ...listInfo } = input ?? {};
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getClientUserList: { userList: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_CLIENT_USER_LIST,
        { input: { clientId, listInfo: { ...listInfo, page } } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getClientUserList.userList, listInfo: res.getClientUserList.listInfo };
    });
  }

  async getClientUser<T = ClientUser>(userId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientUser: T }>(
      opts.query ?? GQL.GET_CLIENT_USER,
      { input: { userId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientUser;
  }

  /** `businessHour`/`holidayList`/`installerInfo` omitted — unresolved nested types, see gql/operations.ts. */
  async getClientSite<T = ClientSite>(id: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientSite: T }>(
      opts.query ?? GQL.GET_CLIENT_SITE,
      { input: { id } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientSite;
  }

  // ---- Contracts ----------------------------------------------------------

  async *iterateClientContracts<T = ClientContract>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getClientContractList: { clientContracts: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_CLIENT_CONTRACT_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getClientContractList.clientContracts, listInfo: res.getClientContractList.listInfo };
    });
  }

  async getClientContract<T = ClientContract>(contractId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientContract: T }>(
      opts.query ?? GQL.GET_CLIENT_CONTRACT,
      { input: { contractId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientContract;
  }

  /** Returns the updated contract's bare ID — SuperOps' mutation returns `ID`, not a `ClientContract` object. */
  async updateClientContract(input: UpdateClientContractInput, opts: CallOpts = {}): Promise<string> {
    const res = await this.http.execute<{ updateClientContract: string }>(
      opts.query ?? GQL.UPDATE_CLIENT_CONTRACT,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateClientContract;
  }

  // ---- Tickets --------------------------------------------------------------

  async *iterateTickets<T = Ticket>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getTicketList: { tickets: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_TICKET_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getTicketList.tickets, listInfo: res.getTicketList.listInfo };
    });
  }

  /** Bare array for one ticket, no pagination. */
  async listTicketNotes<T = Note>(ticketId: string, opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getTicketNoteList: T[] }>(
      opts.query ?? GQL.GET_TICKET_NOTE_LIST,
      { input: { ticketId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTicketNoteList;
  }

  /**
   * Bare array for one ticket, no pagination.
   */
  async listTicketConversations<T = TicketConversation>(
    ticketId: string,
    opts: CallOpts = {},
  ): Promise<T[]> {
    const res = await this.http.execute<{ getTicketConversationList: T[] }>(
      opts.query ?? GQL.GET_TICKET_CONVERSATION_LIST,
      { input: { ticketId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTicketConversationList;
  }

  // ---- Technicians ------------------------------------------------------------

  async *iterateTechnicians<T = Technician>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getTechnicianList: { userList: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_TECHNICIAN_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getTechnicianList.userList, listInfo: res.getTechnicianList.listInfo };
    });
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
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
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
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
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
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createServiceCatalogItem;
  }

  /** Bare array, no pagination — SuperOps has no `input`/`listInfo` for this one, so it's a plain fetch. */
  async listServiceCategories<T = ServiceCategory>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getServiceCategoryList: T[] }>(
      opts.query ?? GQL.GET_SERVICE_CATEGORY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getServiceCategoryList;
  }

  async *iterateServiceItems<T = ServiceItem>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getServiceItemList: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_SERVICE_ITEM_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return res.getServiceItemList;
    });
  }

  async getServiceItem<T = ServiceItem>(itemId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getServiceItem: T }>(
      opts.query ?? GQL.GET_SERVICE_ITEM,
      { input: { itemId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getServiceItem;
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
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getInvoiceList.invoices, listInfo: res.getInvoiceList.listInfo };
    });
  }

  async getInvoice<T = Invoice>(invoiceId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getInvoice: T }>(
      opts.query ?? GQL.GET_INVOICE,
      { input: { invoiceId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getInvoice;
  }

  async createInvoice<T = Invoice>(input: CreateInvoiceInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createInvoice: T }>(
      opts.query ?? GQL.CREATE_INVOICE,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createInvoice;
  }

   async *iterateInvoiceItems<T = InvoiceItem>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getInvoiceItemList: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_INVOICE_ITEM_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return res.getInvoiceItemList;
    });
  }

  // ---- Taxes ------------------------------------------------------------

  async *iterateTaxes<T = Tax>(input?: ListInfoInput, opts: CallOpts = {}): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getTaxList: { taxes: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_TAX_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getTaxList.taxes, listInfo: res.getTaxList.listInfo };
    });
  }

  async getTax<T = Tax>(taxId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getTax: T }>(
      opts.query ?? GQL.GET_TAX,
      { input: { taxId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTax;
  }

  // ---- Reference lists (bare arrays, no pagination) ------------------------

  async listWorkStatuses<T = WorkStatus>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getWorkStatusList: T[] }>(
      opts.query ?? GQL.GET_WORK_STATUS_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getWorkStatusList;
  }

  async listUrgencies<T = Urgency>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getUrgencyList: T[] }>(
      opts.query ?? GQL.GET_URGENCY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getUrgencyList;
  }

  async listCategories<T = Category>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getCategoryList: T[] }>(
      opts.query ?? GQL.GET_CATEGORY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getCategoryList;
  }

  async listSLAs<T = SLA>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getSLAList: T[] }>(
      opts.query ?? GQL.GET_SLA_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getSLAList;
  }

  // ---- Offered items ------------------------------------------------------

  async *iterateOfferedItems<T = OfferedItem>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getOfferedItems: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_OFFERED_ITEMS,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return res.getOfferedItems;
    });
  }

  // ---- Tasks ------------------------------------------------------------

  async *iterateTasks<T = Task>(
    input?: ListInfoInput & { module?: string },
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    const { module, ...listInfo } = input ?? {};
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getTaskList: { tasks: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_TASK_LIST,
        { input: { module, listInfo: { ...listInfo, page } } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getTaskList.tasks, listInfo: res.getTaskList.listInfo };
    });
  }
}

export function createSuperOpsClient(config: SuperOpsClientConfig): SuperOpsClient {
  return new SuperOpsClient(config);
}
