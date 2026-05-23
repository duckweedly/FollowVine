import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const generateMock = vi.fn()
const editMock = vi.fn()
const toFileMock = vi.fn(async (buffer: Buffer, name: string) => ({ buffer, name }))

vi.mock('openai', () => ({
  default: class OpenAI {
    images = {
      generate: generateMock,
      edit: editMock
    }
  },
  toFile: toFileMock
}))

describe('image generation', () => {
  beforeEach(async () => {
    generateMock.mockReset()
    editMock.mockReset()
    toFileMock.mockClear()
    process.env.OPENAI_API_KEY = 'test-key'
    await mkdir(join(process.cwd(), 'storage/generated'), { recursive: true })
  })

  it('writes generated root PNG bytes to storage and returns page metadata', async () => {
    const { generateRootPageImage } = await import('@/lib/image-generation')
    generateMock.mockResolvedValueOnce({ data: [{ b64_json: Buffer.from('png-root').toString('base64') }] })

    const page = await generateRootPageImage('rag 是怎么工作的', 'watercolor_book')

    await expect(readFile(join(process.cwd(), 'storage/generated', `${page.id}.png`), 'utf8')).resolves.toBe('png-root')
    expect(page.imageUrl).toBe(`/generated/${page.id}.png`)
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-image-2' }))
  })

  it('marks the parent PNG as reference input before generating a child page', async () => {
    const { generateChildPageImage } = await import('@/lib/image-generation')
    const parentId = 'pg_0123456789abcdef0123456789abcdef'
    await writeFile(join(process.cwd(), 'storage/generated', `${parentId}.png`), await sharp({ create: { width: 16, height: 9, channels: 3, background: '#ffffff' } }).png().toBuffer())
    editMock.mockResolvedValueOnce({ data: [{ b64_json: Buffer.from('png-child').toString('base64') }] })

    const page = await generateChildPageImage(
      {
        id: parentId,
        imageUrl: `/generated/${parentId}.png`,
        parentId: null,
        parentClick: null,
        initialQuery: 'rag 是怎么工作的',
        style: 'watercolor_book',
        createdAt: '2026-05-23T00:00:00.000Z'
      },
      { x: 0.424, y: 0.634 }
    )

    await expect(readFile(join(process.cwd(), 'storage/generated', `${page.id}.png`), 'utf8')).resolves.toBe('png-child')
    expect(page.parentClick).toEqual({ x: 0.42, y: 0.63 })
    expect(toFileMock).toHaveBeenCalledWith(expect.any(Buffer), `${parentId}-marked.png`)
    expect(editMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-image-2',
      image: expect.anything()
    }))
  })
})
