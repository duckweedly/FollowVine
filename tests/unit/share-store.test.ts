import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareLink } from '@/lib/types'

const queryMock = vi.fn()

vi.mock('@/lib/db', () => ({
  query: queryMock
}))

const share: ShareLink = {
  shareId: 'sh_0123456789abcdef',
  pageIds: ['pg_0123456789abcdef0123456789abcdef'],
  createdAt: '2026-05-23T00:00:00.000Z'
}

describe('share store', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('maps PostgreSQL share rows to ShareLink objects', async () => {
    const { findShareLink } = await import('@/lib/share-store')
    queryMock.mockResolvedValueOnce({ rows: [{ share_id: share.shareId, page_ids: share.pageIds, created_at: new Date(share.createdAt) }] })

    await expect(findShareLink(share.shareId)).resolves.toEqual(share)
  })

  it('saves public unlisted share metadata', async () => {
    const { saveShareLink } = await import('@/lib/share-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await saveShareLink(share)

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into share_links'), [share.shareId, share.pageIds, share.createdAt])
  })
})
