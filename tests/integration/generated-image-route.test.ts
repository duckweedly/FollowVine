import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

describe('GET /generated/{pageId}.png', () => {
  beforeEach(async () => {
    await mkdir(join(process.cwd(), 'storage/generated'), { recursive: true })
  })

  it('returns generated PNG content by page id', async () => {
    const { GET } = await import('@/app/generated/[...pagePath]/route')
    const pageId = 'pg_0123456789abcdef0123456789abcdef'
    await writeFile(join(process.cwd(), 'storage/generated', `${pageId}.png`), Buffer.from([137, 80, 78, 71]))

    const response = await GET(new Request(`http://localhost/generated/${pageId}.png`), { params: Promise.resolve({ pagePath: [`${pageId}.png`] }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    await expect(response.arrayBuffer()).resolves.toEqual(Buffer.from([137, 80, 78, 71]).buffer)
  })

  it('rejects invalid image ids', async () => {
    const { GET } = await import('@/app/generated/[...pagePath]/route')

    const response = await GET(new Request('http://localhost/generated/../secret.png'), { params: Promise.resolve({ pagePath: ['..', 'secret.png'] }) })

    expect(response.status).toBe(400)
  })
})
