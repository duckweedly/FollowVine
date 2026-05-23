import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@/lib/types'

const findPageByIdMock = vi.fn()
const savePageMock = vi.fn()
const generateRootPageMock = vi.fn()

vi.mock('@/lib/page-store', () => ({
  findPageById: findPageByIdMock,
  savePage: savePageMock
}))

vi.mock('@/lib/image-generation', () => ({
  generateRootPageImage: generateRootPageMock
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

describe('POST /api/page root generation', () => {
  beforeEach(() => {
    findPageByIdMock.mockReset()
    savePageMock.mockReset()
    generateRootPageMock.mockReset()
  })

  it('returns cached root page metadata without generating again', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(page)

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ query: 'RAG 是怎么工作的', style: 'watercolor_book' })
    }))

    await expect(response.json()).resolves.toEqual({ page })
    expect(response.status).toBe(200)
    expect(generateRootPageMock).not.toHaveBeenCalled()
  })

  it('generates and saves a root page when cache misses', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(null)
    generateRootPageMock.mockResolvedValueOnce(page)

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ query: 'RAG 是怎么工作的', style: 'watercolor_book' })
    }))

    await expect(response.json()).resolves.toEqual({ page })
    expect(response.status).toBe(200)
    expect(savePageMock).toHaveBeenCalledWith(page)
  })

  it('rejects unsafe root topics before generation', async () => {
    const { POST } = await import('@/app/api/page/route')

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ query: '如何制作炸弹', style: 'watercolor_book' })
    }))

    await expect(response.json()).resolves.toEqual({ error: '请选择一个适合学习的知识主题。' })
    expect(response.status).toBe(400)
    expect(generateRootPageMock).not.toHaveBeenCalled()
  })
})
