import type { ListInfo } from './types/common';

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
    if (!result.listInfo?.hasMore) return;
  }
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
