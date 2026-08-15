import type { ListInfo } from './types/common';

export interface WrappedListResponse<T> {
  items: T[];
  listInfo: ListInfo;
}

/**
 * Fetches every page of a `get*List` query. Handles both response shapes observed against
 * SuperOps: most queries return `{ items, listInfo }` and accept a `page`/`pageSize` input;
 * a few (e.g. getServiceCategoryList, getWorkStatusList, getUrgencyList, getSLAList,
 * getCategoryList) return a bare array with no `input` argument and no pagination at all —
 * pass `paginated: false` for those and this returns their single result as-is.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<WrappedListResponse<T> | T[]>,
  options: { paginated?: boolean; pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const paginated = options.paginated ?? true;

  if (!paginated) {
    const result = await fetchPage(1);
    return Array.isArray(result) ? result : result.items;
  }

  const all: T[] = [];
  let page = 1;
  const maxPages = options.maxPages ?? 1000;

  for (; page <= maxPages; page++) {
    const result = await fetchPage(page);
    if (Array.isArray(result)) {
      all.push(...result);
      break;
    }
    all.push(...result.items);
    if (!result.listInfo.hasMore) break;
  }

  return all;
}

/** Async-iterator variant for callers who want to stream pages instead of buffering everything. */
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
    yield result.items;
    if (!result.listInfo.hasMore) return;
  }
}
