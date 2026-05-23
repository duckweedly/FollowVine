import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@/lib/types'

const queryMock = vi.fn()

vi.mock('@/lib/db', () => ({
  query: queryMock
}))

const page: Page = {
  id: 'pg_0123456789abcdef0123456789abcdef',
  imageUrl: '/generated/pg_0123456789abcdef0123456789abcdef.png',
  parentId: null,
  parentClick: null,
  initialQuery: 'rag 是怎么工作的',
  style: 'watercolor_book',
  createdAt: '2026-05-23T00:00:00.000Z'
}

describe('page store', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns null when PostgreSQL has no page metadata', async () => {
    const { findPageById } = await import('@/lib/page-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(findPageById(page.id)).resolves.toBeNull()
  })

  it('maps PostgreSQL page metadata rows to Page objects', async () => {
    const { findPageById } = await import('@/lib/page-store')
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: page.id,
          image_url: page.imageUrl,
          parent_id: null,
          parent_click: null,
          initial_query: page.initialQuery,
          style: page.style,
          created_at: new Date(page.createdAt)
        }
      ]
    })

    await expect(findPageById(page.id)).resolves.toEqual(page)
  })

  it('upserts page metadata into PostgreSQL', async () => {
    const { savePage } = await import('@/lib/page-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await savePage(page)

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into pages'), [
      page.id,
      page.imageUrl,
      page.parentId,
      page.parentClick,
      page.initialQuery,
      page.style,
      page.createdAt
    ])
  })
})
