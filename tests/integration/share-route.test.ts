import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page, ShareLink } from '@/lib/types'

const findShareLinkMock = vi.fn()
const findPagesByIdsMock = vi.fn()

vi.mock('@/lib/share-store', () => ({
  findShareLink: findShareLinkMock,
  isShareId: (value: string) => /^sh_[a-f0-9]{16}$/.test(value)
}))

vi.mock('@/lib/page-store', () => ({
  findPagesByIds: findPagesByIdsMock
}))

const share: ShareLink = {
  shareId: 'sh_0123456789abcdef',
  pageIds: ['pg_0123456789abcdef0123456789abcdef'],
  createdAt: '2026-05-23T00:00:00.000Z'
}

const page: Page = {
  id: share.pageIds[0],
  imageUrl: `/generated/${share.pageIds[0]}.png`,
  parentId: null,
  parentClick: null,
  initialQuery: 'rag 是怎么工作的',
  style: 'watercolor_book',
  createdAt: '2026-05-23T00:00:00.000Z'
}

describe('public share page', () => {
  beforeEach(() => {
    findShareLinkMock.mockReset()
    findPagesByIdsMock.mockReset()
  })

  it('loads public unlisted share data without sign-in', async () => {
    const { getSharedPages } = await import('@/app/share/[shareId]/page')
    findShareLinkMock.mockResolvedValueOnce(share)
    findPagesByIdsMock.mockResolvedValueOnce([page])

    await expect(getSharedPages(share.shareId)).resolves.toEqual({ share, pages: [page] })
  })

  it('returns null when share metadata is missing', async () => {
    const { getSharedPages } = await import('@/app/share/[shareId]/page')
    findShareLinkMock.mockResolvedValueOnce(null)

    await expect(getSharedPages(share.shareId)).resolves.toBeNull()
  })
})
