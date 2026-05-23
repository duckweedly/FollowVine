import { beforeEach, describe, expect, it, vi } from 'vitest'

const findPageByIdMock = vi.fn()
const savePageMock = vi.fn()
const findPagesByIdsMock = vi.fn()
const generateRootPageMock = vi.fn()
const saveShareLinkMock = vi.fn()

vi.mock('@/lib/page-store', () => ({
  findPageById: findPageByIdMock,
  savePage: savePageMock,
  findPagesByIds: findPagesByIdsMock
}))

vi.mock('@/lib/image-generation', () => ({
  generateRootPageImage: generateRootPageMock,
  generateChildPageImage: vi.fn()
}))

vi.mock('@/lib/share-store', () => ({
  createShareId: () => 'sh_0123456789abcdef',
  saveShareLink: saveShareLinkMock
}))

describe('API contract hardening', () => {
  beforeEach(() => {
    findPageByIdMock.mockReset()
    savePageMock.mockReset()
    findPagesByIdsMock.mockReset()
    generateRootPageMock.mockReset()
    saveShareLinkMock.mockReset()
  })

  it('rejects requests that mix root and child fields', async () => {
    const { POST } = await import('@/app/api/page/route')

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ query: 'RAG 是怎么工作的', style: 'watercolor_book', parentId: 'pg_0123456789abcdef0123456789abcdef', parentClick: { x: 0.5, y: 0.5 } })
    }))

    await expect(response.json()).resolves.toEqual({ error: '请求只能是根页面或子页面之一。' })
    expect(response.status).toBe(400)
  })

  it('returns recoverable JSON when generation fails', async () => {
    const { POST } = await import('@/app/api/page/route')
    findPageByIdMock.mockResolvedValueOnce(null)
    generateRootPageMock.mockRejectedValueOnce(new Error('provider down'))

    const response = await POST(new Request('http://localhost/api/page', {
      method: 'POST',
      body: JSON.stringify({ query: 'RAG 是怎么工作的', style: 'watercolor_book' })
    }))

    await expect(response.json()).resolves.toEqual({ error: '生成失败，换个位置再试。' })
    expect(response.status).toBe(502)
  })

  it('rejects share creation when page ids are invalid or missing', async () => {
    const { POST } = await import('@/app/api/share/route')

    const response = await POST(new Request('http://localhost/api/share', {
      method: 'POST',
      body: JSON.stringify({ pageIds: ['bad-id'] })
    }))

    await expect(response.json()).resolves.toEqual({ error: '没有可分享的图解路径。' })
    expect(response.status).toBe(400)
    expect(saveShareLinkMock).not.toHaveBeenCalled()
  })

  it('rejects share creation when not all page ids resolve', async () => {
    const { POST } = await import('@/app/api/share/route')
    findPagesByIdsMock.mockResolvedValueOnce([])

    const response = await POST(new Request('http://localhost/api/share', {
      method: 'POST',
      body: JSON.stringify({ pageIds: ['pg_0123456789abcdef0123456789abcdef'] })
    }))

    await expect(response.json()).resolves.toEqual({ error: '没有可分享的图解路径。' })
    expect(response.status).toBe(400)
  })
})
