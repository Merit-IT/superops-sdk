import { describe, it, expect } from 'vitest';
import { iteratePages, toArray } from './pagination';

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
});
