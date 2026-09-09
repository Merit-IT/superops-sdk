import { HttpExecutor, type ExecuteOptions, type RetryOptions, type GraphQLError } from './http';
import { iteratePages, withPartialPageRecovery, type WrappedListResponse } from './pagination';
import type { ListInfoInput, ListInfo } from './types/common';
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
  CreateClientInputV2,
  UpdateClientInput,
  CreateClientUserInput,
  UpdateClientUserInput,
  CreateClientSiteInput,
  UpdateClientSiteInput,
  CreateClientContractInput,
  Field,
  CreateFieldInput,
  UpdateFieldInput,
  CreateTicketInput,
  UpdateTicketInput,
  CreateTaskInput,
  CreateWorklogEntryInput,
  UpdateWorklogEntryInput,
  CreateServiceItemInput,
  CreateTaxInput,
  UpdateServiceCatalogItemInput,
  UpdateInvoiceInput,
  CreateTicketNoteInput,
  CreateTicketConversationInput,
  ClientUserAssociation,
  CreateClientUserAssociationInput,
  UpdateClientUserAssociationInput,
  ClientStage,
  Role,
  Priority,
  Impact,
  ResolutionCode,
  Cause,
  Status,
  TechnicianGroup,
  HolidayList,
  PaymentMethod,
  PaymentTerm,
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

/** Used when a `get*List` envelope field itself resolves to null — no error, just empty. */
const EMPTY_LIST_INFO: ListInfo = { totalCount: 0, page: 1, pageSize: 0, hasMore: false };

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
 * Extra opt-in options for `iterate*` methods that support partial-page recovery (see
 * `withPartialPageRecovery` in pagination.ts) — currently `iterateOfferedItems` and
 * `iterateWorklogEntries`, the two endpoints known to hit SuperOps' "one row nulled out"
 * schema violation across many pages of a full sync.
 */
interface PaginatedCallOpts extends CallOpts {
  /**
   * When true, a page that errors but still carries partial data for its list field uses
   * that partial data and keeps paginating, instead of the whole generator throwing and
   * losing every row already fetched. Off by default - errors still throw as normal.
   */
  recoverPartialPages?: boolean;
  onPartialPageError?: (info: { page: number; errors: GraphQLError[]; recoveredCount: number }) => void;
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
      return { items: res.getClientList?.clients ?? [], listInfo: res.getClientList?.listInfo ?? EMPTY_LIST_INFO };
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

  /** `createClient` is deprecated by SuperOps in favor of `createClientV2` — this wraps the latter. */
  async createClient<T = Client>(input: CreateClientInputV2, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createClientV2: T }>(
      opts.query ?? GQL.CREATE_CLIENT_V2,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createClientV2;
  }

  async updateClient<T = Client>(input: UpdateClientInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateClient: T }>(
      opts.query ?? GQL.UPDATE_CLIENT,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateClient;
  }

  /** No `input` argument, no pagination wrapper — returns a bare array. */
  async listClientCustomFields<T = CustomField>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getClientCustomFieldList: T[] }>(
      opts.query ?? GQL.GET_CLIENT_CUSTOM_FIELD_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientCustomFieldList ?? [];
  }

  async getClientCustomField<T = CustomField>(fieldId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientCustomField: T }>(
      opts.query ?? GQL.GET_CLIENT_CUSTOM_FIELD,
      { input: { fieldId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientCustomField;
  }

  /** `createClientCustomField` is deprecated by SuperOps in favor of this generic `createField` mutation. */
  async createField<T = Field>(input: CreateFieldInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createField: T }>(
      opts.query ?? GQL.CREATE_FIELD,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createField;
  }

  async updateField<T = Field>(input: UpdateFieldInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateField: T }>(
      opts.query ?? GQL.UPDATE_FIELD,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateField;
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
      return { items: res.getClientUserList?.userList ?? [], listInfo: res.getClientUserList?.listInfo ?? EMPTY_LIST_INFO };
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

  async createClientUser<T = ClientUser>(input: CreateClientUserInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createClientUser: T }>(
      opts.query ?? GQL.CREATE_CLIENT_USER,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createClientUser;
  }

  async updateClientUser<T = ClientUser>(input: UpdateClientUserInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateClientUser: T }>(
      opts.query ?? GQL.UPDATE_CLIENT_USER,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateClientUser;
  }

  /** `installerInfo` omitted — unresolved nested type. */
  async getClientSite<T = ClientSite>(id: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getClientSite: T }>(
      opts.query ?? GQL.GET_CLIENT_SITE,
      { input: { id } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientSite;
  }

  /** `installerInfo` omitted — unresolved nested type. */
  async createClientSite<T = ClientSite>(input: CreateClientSiteInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createClientSite: T }>(
      opts.query ?? GQL.CREATE_CLIENT_SITE,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createClientSite;
  }

  /** `installerInfo` omitted — unresolved nested type. */
  async updateClientSite<T = ClientSite>(input: UpdateClientSiteInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateClientSite: T }>(
      opts.query ?? GQL.UPDATE_CLIENT_SITE,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateClientSite;
  }

  /**
   * `getClientSiteList` takes its own `GetClientSiteListInput!` — pagination nests under
   * `listInfo`, with `clientId` (optional, narrows to one client's sites) as a sibling key.
   */
  async *iterateClientSites<T = ClientSite>(
    input?: ListInfoInput & { clientId?: string },
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    const { clientId, ...listInfo } = input ?? {};
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getClientSiteList: { sites: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_CLIENT_SITE_LIST,
        { input: { clientId, listInfo: { ...listInfo, page } } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getClientSiteList?.sites ?? [], listInfo: res.getClientSiteList?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  async *iterateClientUserAssociations<T = ClientUserAssociation>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.http.execute<{
        getClientUserAssociationList: { associations: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_CLIENT_USER_ASSOCIATION_LIST,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getClientUserAssociationList?.associations ?? [], listInfo: res.getClientUserAssociationList?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  async createClientUserAssociations<T = ClientUserAssociation>(
    input: CreateClientUserAssociationInput[],
    opts: CallOpts = {},
  ): Promise<T[]> {
    const res = await this.http.execute<{ createClientUserAssociations: T[] }>(
      opts.query ?? GQL.CREATE_CLIENT_USER_ASSOCIATIONS,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createClientUserAssociations ?? [];
  }

  async updateClientUserAssociations<T = ClientUserAssociation>(
    input: UpdateClientUserAssociationInput[],
    opts: CallOpts = {},
  ): Promise<T[]> {
    const res = await this.http.execute<{ updateClientUserAssociations: T[] }>(
      opts.query ?? GQL.UPDATE_CLIENT_USER_ASSOCIATIONS,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateClientUserAssociations ?? [];
  }

  /** Returns the deleted associations' bare IDs. */
  async deleteClientUserAssociations(input: { id: string }[], opts: CallOpts = {}): Promise<string[]> {
    const res = await this.http.execute<{ deleteClientUserAssociations: string[] }>(
      opts.query ?? GQL.DELETE_CLIENT_USER_ASSOCIATIONS,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.deleteClientUserAssociations ?? [];
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
      return { items: res.getClientContractList?.clientContracts ?? [], listInfo: res.getClientContractList?.listInfo ?? EMPTY_LIST_INFO };
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

  /** Returns the new contract's bare ID — SuperOps' mutation returns `ID!`, not a `ClientContract` object. */
  async createClientContract(input: CreateClientContractInput, opts: CallOpts = {}): Promise<string> {
    const res = await this.http.execute<{ createClientContract: string }>(
      opts.query ?? GQL.CREATE_CLIENT_CONTRACT,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createClientContract;
  }

  // ---- Tickets --------------------------------------------------------------

  async *iterateTickets<T = Ticket>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.getTicketsPage<T>({ ...input, page }, opts);
      return { items: res?.tickets ?? [], listInfo: res?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  /**
   * Fetches one page of tickets along with its `listInfo` (`totalCount`/`hasMore`/etc) —
   * unlike `iterateTickets`, which yields bare item pages and drops the pagination metadata.
   * Use this when you're building your own pager (e.g. exposing page/pageSize/totalCount to
   * a frontend) instead of draining the whole list with `toArray`.
   */
  async getTicketsPage<T = Ticket>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): Promise<{ tickets: T[]; listInfo: ListInfo }> {
    const res = await this.http.execute<{
      getTicketList: { tickets: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
    }>(
      opts.query ?? GQL.GET_TICKET_LIST,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    // The envelope itself, or its `tickets` field specifically, can independently resolve
    // to null in a valid, error-free response — guarantee the declared return shape either way.
    return { tickets: res.getTicketList?.tickets ?? [], listInfo: res.getTicketList?.listInfo ?? EMPTY_LIST_INFO };
  }

  async createTicket<T = Ticket>(input: CreateTicketInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createTicket: T }>(
      opts.query ?? GQL.CREATE_TICKET,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createTicket;
  }

  async updateTicket<T = Ticket>(input: UpdateTicketInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateTicket: T }>(
      opts.query ?? GQL.UPDATE_TICKET,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateTicket;
  }

  /** Bare array for one ticket, no pagination. */
  async listTicketNotes<T = Note>(ticketId: string, opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getTicketNoteList: T[] }>(
      opts.query ?? GQL.GET_TICKET_NOTE_LIST,
      { input: { ticketId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTicketNoteList ?? [];
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
    return res.getTicketConversationList ?? [];
  }

  /**
   * Pairs with `listTicketNotes`. Deprecated on SuperOps' schema in favor of `createNote`, but
   * `createNote`'s shape isn't documented yet, so this wraps the existing (still-functional)
   * `createTicketNote` mutation.
   */
  async createTicketNote<T = Note>(input: CreateTicketNoteInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createTicketNote: T }>(
      opts.query ?? GQL.CREATE_TICKET_NOTE,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createTicketNote;
  }

  /** Pairs with `listTicketConversations`. */
  async createTicketConversation<T = TicketConversation>(
    input: CreateTicketConversationInput,
    opts: CallOpts = {},
  ): Promise<T> {
    const res = await this.http.execute<{ createTicketConversation: T }>(
      opts.query ?? GQL.CREATE_TICKET_CONVERSATION,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createTicketConversation;
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. No `input` argument, no pagination wrapper — returns a bare array. */
  async listTicketCustomFields<T = CustomField>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getTicketCustomFieldList: T[] }>(
      opts.query ?? GQL.GET_TICKET_CUSTOM_FIELD_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTicketCustomFieldList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getField` instead. */
  async getTicketCustomField<T = CustomField>(fieldId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getTicketCustomField: T }>(
      opts.query ?? GQL.GET_TICKET_CUSTOM_FIELD,
      { input: { fieldId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTicketCustomField;
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
      return { items: res.getTechnicianList?.userList ?? [], listInfo: res.getTechnicianList?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  // ---- Worklogs ----------------------------------------------------------

  /**
   * `getWorklogEntries` takes its own `GetWorklogEntriesInput!` — pagination/condition nest
   * under `listInfo`, with `module` (`'TICKET' | 'PROJECT'`) as a sibling key.
   */
  async *iterateWorklogEntries<T = WorklogEntry>(
    input?: ListInfoInput & { module?: string },
    opts: PaginatedCallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    const { module, ...listInfo } = input ?? {};
    const fetchPage = async (page: number) => {
      const res = await this.http.execute<{
        getWorklogEntries: { entries: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_WORKLOG_ENTRIES,
        { input: { module, listInfo: { ...listInfo, page } } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return { items: res.getWorklogEntries?.entries ?? [], listInfo: res.getWorklogEntries?.listInfo ?? EMPTY_LIST_INFO };
    };
    yield* iteratePages<T>(
      opts.recoverPartialPages
        ? withPartialPageRecovery(fetchPage, ['getWorklogEntries'], 'entries', opts.onPartialPageError)
        : fetchPage,
    );
  }

  /** SuperOps creates worklog entries in bulk — `input` is a list, response is `[WorklogEntry]`. */
  async createWorklogEntries<T = WorklogEntry>(
    input: CreateWorklogEntryInput[],
    opts: CallOpts = {},
  ): Promise<T[]> {
    const res = await this.http.execute<{ createWorklogEntries: T[] }>(
      opts.query ?? GQL.CREATE_WORKLOG_ENTRIES,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createWorklogEntries ?? [];
  }

  async updateWorklogEntry<T = WorklogEntry>(input: UpdateWorklogEntryInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateWorklogEntry: T }>(
      opts.query ?? GQL.UPDATE_WORKLOG_ENTRY,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateWorklogEntry;
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

  async getServiceCatalogItem<T = ServiceCatalogItem>(itemId: string, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ getServiceCatalogItem: T }>(
      opts.query ?? GQL.GET_SERVICE_CATALOG_ITEM,
      { input: { itemId } },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getServiceCatalogItem;
  }

  async updateServiceCatalogItem<T = ServiceCatalogItem>(
    input: UpdateServiceCatalogItemInput,
    opts: CallOpts = {},
  ): Promise<T> {
    const res = await this.http.execute<{ updateServiceCatalogItem: T }>(
      opts.query ?? GQL.UPDATE_SERVICE_CATALOG_ITEM,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateServiceCatalogItem;
  }

  /** Bare array, no pagination — SuperOps has no `input`/`listInfo` for this one, so it's a plain fetch. */
  async listServiceCategories<T = ServiceCategory>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getServiceCategoryList: T[] }>(
      opts.query ?? GQL.GET_SERVICE_CATEGORY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getServiceCategoryList ?? [];
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

  /** No `updateServiceItem` mutation exists in SuperOps' schema — only create is available. */
  async createServiceItem<T = ServiceItem>(input: CreateServiceItemInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createServiceItem: T }>(
      opts.query ?? GQL.CREATE_SERVICE_ITEM,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createServiceItem;
  }

  // ---- Invoices ------------------------------------------------------------

  async *iterateInvoices<T = Invoice>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    yield* iteratePages<T>(async (page) => {
      const res = await this.getInvoicesPage<T>({ ...input, page }, opts);
      return { items: res?.invoices ?? [], listInfo: res?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  /**
   * Fetches one page of invoices along with its `listInfo` (`totalCount`/`hasMore`/etc) —
   * unlike `iterateInvoices`, which yields bare item pages and drops the pagination metadata.
   * Use this when you're building your own pager (e.g. exposing page/pageSize/totalCount to
   * a frontend) instead of draining the whole list with `toArray`.
   */
  async getInvoicesPage<T = Invoice>(
    input?: ListInfoInput,
    opts: CallOpts = {},
  ): Promise<{ invoices: T[]; listInfo: ListInfo }> {
    const res = await this.http.execute<{
      getInvoiceList: { invoices: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
    }>(
      opts.query ?? GQL.GET_INVOICE_LIST,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    // The envelope itself, or its `invoices` field specifically, can independently resolve
    // to null in a valid, error-free response — guarantee the declared return shape either way.
    return { invoices: res.getInvoiceList?.invoices ?? [], listInfo: res.getInvoiceList?.listInfo ?? EMPTY_LIST_INFO };
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

  async updateInvoice<T = Invoice>(input: UpdateInvoiceInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ updateInvoice: T }>(
      opts.query ?? GQL.UPDATE_INVOICE,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.updateInvoice;
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
      return { items: res.getTaxList?.taxes ?? [], listInfo: res.getTaxList?.listInfo ?? EMPTY_LIST_INFO };
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

  /** No `updateTax` mutation exists in SuperOps' schema — only create is available. */
  async createTax<T = Tax>(input: CreateTaxInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createTax: T }>(
      opts.query ?? GQL.CREATE_TAX,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createTax;
  }

  // ---- Reference lists (bare arrays, no pagination) ------------------------

  async listWorkStatuses<T = WorkStatus>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getWorkStatusList: T[] }>(
      opts.query ?? GQL.GET_WORK_STATUS_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getWorkStatusList ?? [];
  }

  async listUrgencies<T = Urgency>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getUrgencyList: T[] }>(
      opts.query ?? GQL.GET_URGENCY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getUrgencyList ?? [];
  }

  async listCategories<T = Category>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getCategoryList: T[] }>(
      opts.query ?? GQL.GET_CATEGORY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getCategoryList ?? [];
  }

  async listSLAs<T = SLA>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getSLAList: T[] }>(
      opts.query ?? GQL.GET_SLA_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getSLAList ?? [];
  }

  async listClientStages<T = ClientStage>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getClientStageList: T[] }>(
      opts.query ?? GQL.GET_CLIENT_STAGE_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getClientStageList ?? [];
  }

  async listRequesterRoles<T = Role>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getRequesterRoleList: T[] }>(
      opts.query ?? GQL.GET_REQUESTER_ROLE_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getRequesterRoleList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. */
  async listPriorities<T = Priority>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getPriorityList: T[] }>(
      opts.query ?? GQL.GET_PRIORITY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getPriorityList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. */
  async listImpacts<T = Impact>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getImpactList: T[] }>(
      opts.query ?? GQL.GET_IMPACT_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getImpactList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. */
  async listResolutionCodes<T = ResolutionCode>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getResolutionCodeList: T[] }>(
      opts.query ?? GQL.GET_RESOLUTION_CODE_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getResolutionCodeList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. */
  async listCauses<T = Cause>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getCauseList: T[] }>(
      opts.query ?? GQL.GET_CAUSE_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getCauseList ?? [];
  }

  /** @deprecated on SuperOps' schema — use `getFields` instead. */
  async listStatuses<T = Status>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getStatusList: T[] }>(
      opts.query ?? GQL.GET_STATUS_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getStatusList ?? [];
  }

  async listTechnicianGroups<T = TechnicianGroup>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getTechnicianGroupList: T[] }>(
      opts.query ?? GQL.GET_TECHNICIAN_GROUP_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getTechnicianGroupList ?? [];
  }

  /** Each entry is a named list of holidays (e.g. "USA Holidays"), not a single holiday. */
  async listHolidayLists<T = HolidayList>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getHolidayList: T[] }>(
      opts.query ?? GQL.GET_HOLIDAY_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getHolidayList ?? [];
  }

  async listPaymentMethods<T = PaymentMethod>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getPaymentMethodList: T[] }>(
      opts.query ?? GQL.GET_PAYMENT_METHOD_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getPaymentMethodList ?? [];
  }

  async listPaymentTerms<T = PaymentTerm>(opts: CallOpts = {}): Promise<T[]> {
    const res = await this.http.execute<{ getPaymentTermList: T[] }>(
      opts.query ?? GQL.GET_PAYMENT_TERM_LIST,
      undefined,
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.getPaymentTermList ?? [];
  }

  // ---- Offered items ------------------------------------------------------

  async *iterateOfferedItems<T = OfferedItem>(
    input?: ListInfoInput,
    opts: PaginatedCallOpts = {},
  ): AsyncGenerator<T[], void, void> {
    const fetchPage = async (page: number) => {
      const res = await this.http.execute<{
        getOfferedItems: { items: T[]; listInfo: WrappedListResponse<T>['listInfo'] };
      }>(
        opts.query ?? GQL.GET_OFFERED_ITEMS,
        { input: { ...input, page } },
        { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
      );
      return res.getOfferedItems;
    };
    yield* iteratePages<T>(
      opts.recoverPartialPages
        ? withPartialPageRecovery(fetchPage, ['getOfferedItems'], 'items', opts.onPartialPageError)
        : fetchPage,
    );
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
      return { items: res.getTaskList?.tasks ?? [], listInfo: res.getTaskList?.listInfo ?? EMPTY_LIST_INFO };
    });
  }

  /** No `updateTask` mutation exists in SuperOps' schema — only create is available. */
  async createTask<T = Task>(input: CreateTaskInput, opts: CallOpts = {}): Promise<T> {
    const res = await this.http.execute<{ createTask: T }>(
      opts.query ?? GQL.CREATE_TASK,
      { input },
      { errorPolicy: opts.errorPolicy, retryOnGraphQLError: opts.retryOnGraphQLError },
    );
    return res.createTask;
  }
}

export function createSuperOpsClient(config: SuperOpsClientConfig): SuperOpsClient {
  return new SuperOpsClient(config);
}
