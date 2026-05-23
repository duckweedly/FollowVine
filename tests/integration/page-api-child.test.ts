import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@/lib/types'

const findPageByIdMock = vi.fn()
const savePageMock = vi.fn()
const generateChildPageMock = vi.fn()

vi.mock('@/lib/page-store', () => ({
  findPageById: findPageByIdMock,
  savePage: savePageMock
}))

vi.mock('@/lib/image-generation', () => ({
  generateChildPageImage: generateChildPageMock,
  generateRootPageImage: vi.fn()
}))

const parentPage: Page = {
  id: 'pg_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  imageUrl: '/generated/pg_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
  parentId: null,
  parentClick: null,
  initialQuery: 'rag 是怎么工作的',
  style: 'watercolor_book',
  createdAt: '2026-05-23T00:00:00.000Z'
}

const childPage: Page = {
  id: 'pg_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  imageUrl: '/generated/pg_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png',
  parentId: parentPage.id,
  parentClick: { x: 0.42, y: 0.63 },
  initialQuery: null,
  style: 'watercolor_book',
  createdAt: '2026-05-23T00:00:01.000Z'
}

describe('POST /api/page child generation', () => {
  beforeEach(() => {
    findPageByIdMock.mockReset()
    savePageMock.mockReset()
    generateChildPageMock.mockReset()
  })

  it('returns cached child page metadata without generating again', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(parentPage).mockResolvedValueOnce(childPage)

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ parentId: parentPage.id, parentClick: { x: 0.424, y: 0.634 } })
    }))

    await expect(response.json()).resolves.toEqual({ page: childPage })
    expect(generateChildPageMock).not.toHaveBeenCalled()
  })

  it('generates and saves a child page on cache miss', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(parentPage).mockResolvedValueOnce(null)
    generateChildPageMock.mockResolvedValueOnce(childPage)

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ parentId: parentPage.id, parentClick: { x: 0.424, y: 0.634 } })
    }))

    await expect(response.json()).resolves.toEqual({ page: childPage })
    expect(generateChildPageMock).toHaveBeenCalledWith(parentPage, { x: 0.424, y: 0.634 })
    expect(savePageMock).toHaveBeenCalledWith(childPage)
  })

  it('rejects child generation when parent page does not exist', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(null)

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ parentId: parentPage.id, parentClick: { x: 0.42, y: 0.63 } })
    }))

    await expect(response.json()).resolves.toEqual({ error: '找不到上一页。' })
    expect(response.status).toBe(404)
  })
})
