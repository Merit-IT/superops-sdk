# SUPEROPS-SDK
### TypeScript SDK wrapping the SuperOps PSA GraphQL API (`https://api.superops.ai/msp`)
- Only in initial version we wrapped endpoints we use for our various internal functions and services.
- Anything not yet wrapped as a typed method — use the escape hatch:

```ts
const data = await superops.query(`query { getTaskList { id } }`);
```

## Coverage

What's wrapped as a typed method today

| Entity | Read | Write 
|---|---|---|
| Client | `iterateClients`, `getClient` | — 
| ClientUser | `iterateClientUsers`, `getClientUser` | — |
| ClientSite | `getClientSite` | — |
| CustomField | `listClientCustomFields`, `getClientCustomField` | — |
| ClientContract | `iterateClientContracts`, `getClientContract` | `updateClientContract` |
| WorklogEntry | `iterateWorklogEntries` | — | 
| ServiceCatalogItem | `iterateServiceCatalogItems` | `createServiceCatalogItem` | 
| ServiceCategory | `listServiceCategories` | — |
| Invoice | `iterateInvoices`, `getInvoice` | `createInvoice` | 
| InvoiceItem | `iterateInvoiceItems` | — |
| Ticket | `iterateTickets` | — |
| Note (ticket notes) | `listTicketNotes` | — |
| Technician | `iterateTechnicians` | — |
| Tax | `iterateTaxes`, `getTax` | — |
| WorkStatus | `listWorkStatuses` | — |
| Urgency | `listUrgencies` | — |
| Category | `listCategories` | — |
| SLA | `listSLAs` | — |
| OfferedItem | `iterateOfferedItems` | — |
| Task | `iterateTasks` | — |
| ServiceItem ⚠️ | `iterateServiceItems`, `getServiceItem` | — |
| TicketConversation | `listTicketConversations` | — |

⚠️ **`ServiceItem` (SuperOps' own "Service Items (Legacy)" endpoint) is real flaky. Our Tickets to support have them acknowledging but no planned fix**

## Features

- **Retry/backoff** on 429/502/503/504 and network errors, honoring `Retry-After` — plus opt-in
  retry on GraphQL-level execution errors (`retryOnGraphQLError`) for endpoints like SuperOps'
  known-flaky "Service Items (Legacy)" one, which fails with HTTP 200 + `errors[]`, a failure mode
  the HTTP-status retry never catches. See "Retrying flaky GraphQL errors" below.
- **Streaming pagination** via async generators (`iterateClients`, etc.) that handle both
  response shapes SuperOps actually returns: most `get*List` queries wrap results as
  `{ items, listInfo }`, but a few (`getServiceCategoryList`, `getWorkStatusList`,
  `getUrgencyList`, `getSLAList`, `getCategoryList`) return a bare array with no `input`
  argument at all. Consumers control how much gets fetched simply by how long they keep
  iterating — `break` early and no further requests happen.
- **Single-tenant or per-request auth.** Configure one `{ apiKey, subdomain }` for the common
  case (one deployment, one bearer token), or pass `resolveAuth()` for multi-tenant services
  like an MCP server that resolves credentials per incoming request.
- Canonical `Client`, `ClientContract`, `WorklogEntry`, `ServiceCatalogItem`, etc. types —
  see [`src/types/entities.ts`](./src/types/entities.ts) for what's verified vs. best-effort.
- **No built-in caching.** `CacheService`/`MemoryCacheStore` (the TTL + in-flight-dedup pattern
  that `software-audit` and `quoter-middleware` had independently copy-pasted) are exported as a
  standalone, composable primitive — but the SDK doesn't wrap calls in it automatically, since
  what to cache, for how long, and when to invalidate varies per consumer and the SDK can't
  guess that correctly on your behalf. See "Caching" below.

## Install

Consuming apps need a GitHub Packages auth token (a PAT with `read:packages`) in their `.npmrc`:

```
@merit-it:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```
npm install @merit-it/superops-sdk
```

## Usage

```ts
import { createSuperOpsClient } from '@merit-it/superops-sdk';

const superops = createSuperOpsClient({
  apiKey: process.env.SUPEROPS_BEARER_TOKEN!,
  subdomain: process.env.SUPEROPS_SUBDOMAIN!,
});

// Every list operation is an async generator — stream page by page:
for await (const page of superops.iterateClients()) {
  console.log(page.length, 'clients in this page');
}

const updatedId = await superops.updateClientContract({
  contract: {
    contractId,
    billableContract: {
      change: { quantity: '5', quantityChangeOperation: 'INCREASE', effectiveDate: '2026-01-01' },
    },
  },
});
```

### Pagination

Every list operation (`iterateClients`, `iterateClientContracts`, `iterateWorklogEntries`,
`iterateServiceCatalogItems`) is a single async generator — no separate "give me everything"
vs. "give me one page" methods to choose between. You decide how much to consume:

```ts
import { toArray } from '@merit-it/superops-sdk';

// Stream + stop early: breaking out of the loop means no further SuperOps requests happen.
for await (const page of superops.iterateClientContracts({ pageSize: 50 })) {
  if (foundWhatINeed(page)) break;
}

// Or buffer everything into one array with the shared drain helper:
const allContracts = await toArray(superops.iterateClientContracts());

// toArray also accepts maxPages, equivalent to breaking after N pages:
const firstThreePages = await toArray(superops.iterateClients(), { maxPages: 3 });
```

### Filtering Example Usage

```ts
// All invoices 
const invoices = await toArray(superops.iterateInvoices());

// Overdue only
const overdue = await toArray(
  superops.iterateInvoices({
    condition: { attribute: 'statusEnum', operator: 'EQUALS', operands: { string: ['OVERDUE'] } },
  }),
);

const invoice = await superops.getInvoice(invoiceId);
```


### Overriding the default field selection

Every typed method accepts an optional `query` override plus its own generic type parameter, so
you're not stuck with the SDK's default field selection — the response envelope
(`{ items, listInfo }` vs bare array) has to stay the same shape, but which fields come back
inside it is entirely up to you:

```ts
interface MyContract {
  contractId: string;
  contractStatus: string;
}

for await (const page of superops.iterateClientContracts<MyContract>(undefined, {
  query: `
    query GetClientContractList($input: ListInfoInput) {
      getClientContractList(input: $input) {
        clientContracts { contractId contractStatus }
        listInfo { totalCount page pageSize hasMore }
      }
    }
  `,
})) {
  // page: MyContract[]
}
```

### Caching

The SDK itself doesn't cache. `CacheService` (TTL + in-flight request de-duplication, so
concurrent callers for the same key share one outstanding fetch instead of firing duplicate
SuperOps requests) is exported standalone — wire it up around whichever calls make sense for
your app, with whatever keys/TTLs/invalidation fit your access patterns:

```ts
import { CacheService, toArray } from '@merit-it/superops-sdk';

const cache = new CacheService({ defaultTtlMs: 300_000 });

const clients = await cache.getOrSet('superops:clients', () =>
  toArray(superops.iterateClients()),
);

// After a mutation, invalidate whatever keys your app actually populated —
// you know your own filters/pagination, the SDK doesn't guess for you.
await superops.updateClientContract({ contract: { /* ... */ } });
cache.delete('superops:contracts');
```

### Retrying flaky GraphQL errors

SuperOps' HTTP-status retry (429/502/503/504) doesn't fire for a GraphQL-level failure — an
HTTP-200 response with an `errors[]` array, which is exactly how their
`getServiceItemList`/`getServiceItem` endpoint fails. `retryOnGraphQLError` (client-wide default
or per-call override) fills that gap — pass a predicate over the error messages, and it retries
with the same backoff as everything else:

```ts
import { createSuperOpsClient, isTransientSuperOpsError } from '@merit-it/superops-sdk';

// Client-wide default:
const superops = createSuperOpsClient({
  apiKey: process.env.SUPEROPS_BEARER_TOKEN!,
  subdomain: process.env.SUPEROPS_SUBDOMAIN!,
  defaultRetryOnGraphQLError: isTransientSuperOpsError,
});

// Or per-call, if you only want it for the known-flaky operations:
const serviceItems = await toArray(
  superops.iterateServiceItems(undefined, { retryOnGraphQLError: isTransientSuperOpsError }),
);
```