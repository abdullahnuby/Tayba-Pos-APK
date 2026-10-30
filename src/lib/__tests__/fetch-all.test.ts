import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllPagedItems } from '../fetch-all'

afterEach(() => vi.unstubAllGlobals())

describe('fetchAllPagedItems', () => {
  it('reads every 200-item catalogue page until the server total is reached', async () => {
    const pages = [
      Array.from({ length: 200 }, (_, index) => ({ id: index + 1 })),
      Array.from({ length: 200 }, (_, index) => ({ id: index + 201 })),
      [{ id: 401 }],
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      const page = Number(url.searchParams.get('page'))
      return {
        ok: true,
        json: async () => ({ items: pages[page - 1], total: 401, page, pageSize: 200 }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAllPagedItems<{ id: number }>('/api/products?pageSize=1000')

    expect(result.total).toBe(401)
    expect(result.items).toHaveLength(401)
    expect(result.items[0].id).toBe(1)
    expect(result.items.at(-1)?.id).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const requestedPages = fetchMock.mock.calls.map(([input]) =>
      new URL(String(input), 'http://localhost').searchParams.get('page'),
    )
    expect(requestedPages).toEqual(['1', '2', '3'])
  })

  it('stops cleanly on an empty list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 200 }),
    }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAllPagedItems('/api/products')

    expect(result).toEqual({ items: [], total: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a short intermediate page when the server reports more results', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      const page = Number(url.searchParams.get('page'))
      return {
        ok: true,
        json: async () => ({
          items: page === 1 ? [{ id: 1 }] : [],
          total: 401,
          page,
          pageSize: 200,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAllPagedItems('/api/products'))
      .rejects.toThrow(/قبل اكتمال جميع النتائج/)
  })

  it('preserves server error details rather than returning a partial list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'قاعدة البيانات غير متاحة' }),
    }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAllPagedItems('/api/products'))
      .rejects.toThrow('قاعدة البيانات غير متاحة')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
