import type { ListInfo } from './types/common';
import { SuperOpsGraphQLError, type GraphQLError } from './http';

export interface WrappedListResponse<T> {
  items: T[];
  listInfo: ListInfo;
}

/**
 * Streams every page of a `get*List` query, one page at a time. 
 *
 * Consuming app control how much to fetch simply by how long they keep iterating — `break` out of
 * a `for await` early and no further pages are requested. Use `toArray()` below if you want the
 * whole thing buffered into one array instead of streamed.
 */
export async function* iteratePages<T>(
  fetchPage: (page: number) => Promise<WrappedListResponse<T> | T[]>,
  options: { paginated?: boolean; maxPages?: number } = {},
): AsyncGenerator<T[], void, void> {
  const paginated = options.paginated ?? true;

  if (!paginated) {
    const result = await fetchPage(1);
    yield Array.isArray(result) ? result : result.items;
    return;
  }

  const maxPages = options.maxPages ?? 1000;
  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPage(page);
    if (Array.isArray(result)) {
      yield result;
      return;
    }
    // A `get*List`-style field can legitimately resolve to null (no error, just an empty
    // envelope) — treat that the same as an empty page rather than crashing on `.items`.
    if (!result) {
      yield [];
      return;
    }
    yield result.items ?? [];

    // A response that has a listInfo envelope but no `hasMore` KEY at all (as opposed to the
    // key being present with value `false` or, per SuperOps, sometimes legitimately `null` on
    // the last page) almost always means a caller-supplied `query` override (see the README's
    // "Overriding the default field selection" section) forgot to select `listInfo { hasMore }`.
    // GraphQL omits unselected fields entirely rather than nulling them, so key-presence is what
    // actually distinguishes "not selected" (throw) from "selected but the server returned null"
    // (treat as done, same as `false`) - checking `typeof === 'boolean'` conflated the two and
    // rejected SuperOps' own default query's legitimate `hasMore: null` response.
    if (result.listInfo && !('hasMore' in result.listInfo)) {
      throw new Error(
        `iteratePages: page ${page}'s response has a listInfo envelope but no \`hasMore\` key ` +
          'at all. If you passed a custom `query` override, make sure it selects ' +
          '`listInfo { hasMore }` - without it, pagination cannot tell when to stop and ' +
          'would otherwise silently return only this page.',
      );
    }
    if (!result.listInfo?.hasMore) return;
  }
}

/**
 * Wraps a paginated `fetchPage` callback so that a page whose request throws a
 * `SuperOpsGraphQLError` still yields whatever partial data came back for the expected list
 * field, instead of aborting the whole `iteratePages` generator and losing every row already
 * fetched. SuperOps is known to return `errors[]` alongside a genuinely populated `data` for
 * some list endpoints - e.g. one row violating a non-null schema type (a documented, expected
 * shape of its API, not a transient failure) - and the default `errorPolicy: 'throw'` treats
 * that the same as a real failure.
 *
 * This differs from `errorPolicy: 'tolerant'` in two ways: (1) it only recovers when the
 * *specific list field* you're reading survived as an array - `tolerant` merely checks that
 * the top-level `data` is non-null, which a field-level failure (`{ data: { getXList: null },
 * errors: [...] }`) still satisfies, silently yielding an empty page; (2) after recovering a
 * broken page it keeps paginating to the next page (assuming there's more data whenever the
 * broken page wasn't itself empty) instead of treating the broken page as the end of the list.
 *
 * `resultPath`/`listField` describe where the list lives in the error's `data` payload, same
 * as the shape a successful response for that query would have - e.g. for
 * `getOfferedItems { items ... }` that's `resultPath: ['getOfferedItems'], listField: 'items'`.
 */
export function withPartialPageRecovery<T>(
  fetchPage: (page: number) => Promise<WrappedListResponse<T> | T[]>,
  resultPath: string[],
  listField: string,
  onPartialError?: (info: { page: number; errors: GraphQLError[]; recoveredCount: number }) => void,
): (page: number) => Promise<WrappedListResponse<T> | T[]> {
  return async (page: number) => {
    try {
      return await fetchPage(page);
    } catch (err) {
      if (!(err instanceof SuperOpsGraphQLError)) throw err;

      let node: unknown = err.data;
      for (const key of resultPath) node = (node as Record<string, unknown> | undefined)?.[key];
      const partialItems = (node as Record<string, unknown> | undefined)?.[listField];
      if (!Array.isArray(partialItems)) throw err;

      const items = partialItems.filter((item: unknown) => item != null) as T[];
      onPartialError?.({ page, errors: err.errors, recoveredCount: items.length });

      // The broken page's own listInfo isn't trustworthy (that's what errored) - assume
      // there's more to fetch only if this page actually had rows; an empty recovered page
      // stops here rather than retrying indefinitely against a permanently broken endpoint.
      return { items, listInfo: { totalCount: 0, page, pageSize: items.length, hasMore: items.length > 0 } };
    }
  };
}

/**
 * Drains a page-yielding async generator (e.g. `superops.iterateClients()`) into one flat
 * array. Pass `maxPages` to stop early instead of exhausting the whole list — this stops the
 * generator (and further SuperOps requests) as soon as the cap is hit, same as `break`ing out
 * of a `for await` loop manually.
 */
export async function toArray<T>(
  pages: AsyncGenerator<T[], void, void>,
  options: { maxPages?: number } = {},
): Promise<T[]> {
  const all: T[] = [];
  let count = 0;
  for await (const page of pages) {
    all.push(...page);
    count++;
    if (options.maxPages != null && count >= options.maxPages) {
      await pages.return?.();
      break;
    }
  }
  return all;
}
