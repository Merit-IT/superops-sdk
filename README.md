# @merit-it/superops-sdk

TypeScript SDK wrapping the SuperOps PSA GraphQL API (`https://api.superops.ai/msp`), built to
replace the duplicated SuperOps client code across `superops-mcp`, `Serverless`,
`software-audit`, `clientPortal`, and `quoter-middleware`.

## Features

- **Retry/backoff** on 429/502/503/504 and network errors, honoring `Retry-After`.
- **TTL cache with in-flight de-duplication**, generalized from the `cache.service.ts` pattern
  that `software-audit` and `quoter-middleware` had independently copy-pasted. Pluggable
  `CacheStore` if you want Redis later instead of the in-memory default.
- **Auto-pagination** that handles both response shapes SuperOps actually returns: most
  `get*List` queries wrap results as `{ items, listInfo }`, but a few
  (`getServiceCategoryList`, `getWorkStatusList`, `getUrgencyList`, `getSLAList`,
  `getCategoryList`) return a bare array with no `input` argument at all.
- **Single-tenant or per-request auth.** Configure one `{ apiKey, subdomain }` for the common
  case (one deployment, one bearer token), or pass `resolveAuth()` for multi-tenant services
  like an MCP server that resolves credentials per incoming request.
- Canonical `Client`, `ClientContract`, `WorklogEntry`, `ServiceCatalogItem`, etc. types —
  see [`src/types/entities.ts`](./src/types/entities.ts) for what's verified vs. best-effort.

## Install

Consumers need a GitHub Packages auth token (a PAT with `read:packages`) in their `.npmrc`:

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

const clients = await superops.listClients();
const contracts = await superops.listClientContracts({ pageSize: 50 });

await superops.updateClientContract({ id: contractId, quantity: 5 });
```

Every typed list/get/mutation method accepts an optional `query` override plus its own generic
type parameter, so you're not stuck with the SDK's default field selection — the response
envelope (`{ items, listInfo }` vs bare array) has to stay the same shape, but which fields come
back inside it is entirely up to you:

```ts
interface MyContract {
  id: string;
  changes: { type: string; quantity: number }[];
}

const contracts = await superops.listClientContracts<MyContract>(undefined, {
  query: `
    query GetClientContractList($input: ListInfoInput) {
      getClientContractList(input: $input) {
        contracts { id changes { type quantity } }
        listInfo { totalCount page pageSize hasMore }
      }
    }
  `,
});
```

Cache keys automatically fold in the overridden query, so a custom field selection never
collides with (or gets served from) a cache entry built from the default one.

Multi-tenant (per-request credentials):

```ts
const superops = createSuperOpsClient({
  resolveAuth: () => ({ apiKey: getApiKeyForCurrentRequest(), subdomain: 'merit' }),
});
```

Anything not yet wrapped as a typed method — use the escape hatch:

```ts
const data = await superops.query(`query { getTaskList { id } }`);
```

## Design notes / known gaps

This was scaffolded from an audit of the 5 consumer projects (see git history / PR description
for the full report). A few things worth knowing before you lean on this:

- Only `Client`, `ClientContract`, `WorklogEntry`, and `ServiceCatalogItem` field selections were
  confirmed against live SuperOps responses during the audit. Other operations
  (`getTicketList`, `getInvoiceList`, `getClientUserList`, `getOfferedItems`, etc.) aren't wrapped
  yet — add them to `src/gql/operations.ts` + `src/client.ts` as you migrate each consumer, and
  verify field names against the live schema (an `introspect-superops.ts` script was referenced
  in quoter-middleware's history if you need a starting point).
- `hqSite` on `Client` is a JSON scalar on the wire despite having a `{id, name}` shape — it is
  **not** sub-selectable in GraphQL, don't try to query nested fields on it.
- Don't confuse `SuperOpsServiceItem` (the raw API entity, `{itemId, name, quantityType}`) with
  a per-product business enum of service categories (what `software-audit` calls `ServiceItem`
  locally) — keep your own domain enum separate and map into/out of the SDK type at the edge.
- `CustomerSubDomain` was hardcoded to `'merit'` in some consumers — always pass it explicitly
  through config here instead.
