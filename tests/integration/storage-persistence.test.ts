import { describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('@/lib/db', () => ({
  query: queryMock
}))

describe('PostgreSQL-backed persistence', () => {
  it('reads page metadata from PostgreSQL instead of process memory', async () => {
    const { findPageById } = await import('@/lib/page-store')
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'pg_0123456789abcdef0123456789abcdef',
          image_url: '/generated/pg_0123456789abcdef0123456789abcdef.png',
          parent_id: null,
          parent_click: null,
          initial_query: 'rag 是怎么工作的',
          style: 'watercolor_book',
          created_at: new Date('2026-05-23T00:00:00.000Z')
        }
      ]
    })

    await expect(findPageById('pg_0123456789abcdef0123456789abcdef')).resolves.toMatchObject({
      id: 'pg_0123456789abcdef0123456789abcdef'
    })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('from pages'), ['pg_0123456789abcdef0123456789abcdef'])
  })
})
