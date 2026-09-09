import { describe, it, expect, vi } from 'vitest';
import { iteratePages, toArray, withPartialPageRecovery } from './pagination';
import { SuperOpsGraphQLError } from './http';

describe('iteratePages', () => {
  it('yields each page and stops when hasMore is false', async () => {
    const fetchPage = async (page: number) => ({
      items: [page],
      listInfo: { totalCount: 2, page, pageSize: 1, hasMore: page < 2 },
    });

    expect(await toArray(iteratePages(fetchPage))).toEqual([1, 2]);
  });

  // A `get*List`-style field can legitimately resolve to null (a valid GraphQL response,
  // no errors) — this must resolve to an empty page, not throw on `.items`.
  it('treats a null page result as an empty page', async () => {
    const fetchPage = async () => null as unknown as { items: number[]; listInfo: { hasMore: boolean } };

    expect(await toArray(iteratePages(fetchPage))).toEqual([]);
  });

  it('treats a null `items` field (envelope present) as an empty page', async () => {
    const fetchPage = async () => ({
      items: null as unknown as number[],
      listInfo: { totalCount: 0, page: 1, pageSize: 0, hasMore: false },
    });

    expect(await toArray(iteratePages(fetchPage))).toEqual([]);
  });

  it('stops after a bare array result (non-paginated escape hatch)', async () => {
    const fetchPage = async () => [1, 2, 3];

    expect(await toArray(iteratePages(fetchPage))).toEqual([1, 2, 3]);
  });

  // A custom `query` override that forgets to select `listInfo { hasMore }` must fail loudly
  // instead of silently stopping after page 1 - regression test for a real bug where a
  // hand-written worklog_entries query without `hasMore` truncated a sync from thousands of
  // rows down to 100.
  it('throws if listInfo is present but hasMore is missing, instead of silently stopping', async () => {
    const fetchPage = async (page: number) => ({
      items: [page],
      listInfo: { totalCount: 2, page, pageSize: 1 } as unknown as { hasMore: boolean },
    });

    await expect(toArray(iteratePages(fetchPage))).rejects.toThrow(/hasMore/);
  });

  // SuperOps' own default query for getServiceCatalogItemList (which does select
  // `listInfo { hasMore }`) has been observed returning `hasMore: null` rather than `false` on
  // the last page. That's a legitimate response with the key present, distinct from a caller
  // forgetting to select the field (key absent, covered above) - must stop cleanly, not throw.
  it('treats hasMore: null (key present) as no more pages, not a missing-selection error', async () => {
    const fetchPage = async (page: number) => ({
      items: [page],
      listInfo: { totalCount: 1, page, pageSize: 1, hasMore: null } as unknown as { hasMore: boolean },
    });

    expect(await toArray(iteratePages(fetchPage))).toEqual([1]);
  });
});

describe('withPartialPageRecovery', () => {
  it('uses partial data from a page that errored, then keeps paginating', async () => {
    const onPartialPageError = vi.fn();
    const fetchPage = vi.fn(async (page: number) => {
      if (page === 1) {
        throw new SuperOpsGraphQLError(
          'one row nulled out',
          [{ message: 'Cannot return null for non-nullable type' }],
          { getOfferedItems: { items: [{ itemId: 'a' }, null, { itemId: 'b' }], listInfo: null } },
        );
      }
      return { items: [{ itemId: 'c' }], listInfo: { totalCount: 3, page, pageSize: 1, hasMore: false } };
    });

    const recovered = withPartialPageRecovery(fetchPage, ['getOfferedItems'], 'items', onPartialPageError);
    const rows = await toArray(iteratePages(recovered));

    expect(rows).toEqual([{ itemId: 'a' }, { itemId: 'b' }, { itemId: 'c' }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(onPartialPageError).toHaveBeenCalledWith({ page: 1, errors: expect.any(Array), recoveredCount: 2 });
  });

  it('stops instead of retrying forever when the recovered page is itself empty', async () => {
    const fetchPage = vi.fn(async () => {
      throw new SuperOpsGraphQLError('broken', [{ message: 'broken' }], { getOfferedItems: { items: [] } });
    });

    const recovered = withPartialPageRecovery(fetchPage, ['getOfferedItems'], 'items');
    const rows = await toArray(iteratePages(recovered));

    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('rethrows when the error carries no usable partial data for the list field', async () => {
    const fetchPage = async () => {
      throw new SuperOpsGraphQLError('broken', [{ message: 'broken' }], { getOfferedItems: null });
    };

    const recovered = withPartialPageRecovery(fetchPage, ['getOfferedItems'], 'items');
    await expect(toArray(iteratePages(recovered))).rejects.toBeInstanceOf(SuperOpsGraphQLError);
  });

  it('passes through non-GraphQL errors untouched', async () => {
    const fetchPage = async () => {
      throw new TypeError('network down');
    };

    const recovered = withPartialPageRecovery(fetchPage, ['getOfferedItems'], 'items');
    await expect(toArray(iteratePages(recovered))).rejects.toThrow('network down');
  });
});
