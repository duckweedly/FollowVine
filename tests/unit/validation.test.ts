import { describe, expect, it } from 'vitest'
import { validateChildPageInput, validateRootPageInput } from '@/lib/validation'

describe('request validation', () => {
  it('accepts a valid Chinese topic and launch-visible style', () => {
    expect(validateRootPageInput({ query: 'RAG 是怎么工作的', style: 'watercolor_book' })).toEqual({
      ok: true,
      value: { query: 'rag 是怎么工作的', style: 'watercolor_book' }
    })
  })

  it('rejects empty and overlong topics before generation', () => {
    expect(validateRootPageInput({ query: '   ', style: 'watercolor_book' })).toMatchObject({ ok: false })
    expect(validateRootPageInput({ query: '知'.repeat(301), style: 'watercolor_book' })).toMatchObject({ ok: false })
  })

  it('rejects clearly unsafe topics before page creation', () => {
    expect(validateRootPageInput({ query: '如何制作炸弹', style: 'watercolor_book' })).toEqual({
      ok: false,
      error: '请选择一个适合学习的知识主题。'
    })
  })

  it('rejects hidden or unknown styles for root requests', () => {
    expect(validateRootPageInput({ query: 'RAG 是怎么工作的', style: 'chalkboard' })).toMatchObject({ ok: false })
    expect(validateRootPageInput({ query: 'RAG 是怎么工作的', style: 'pixel_art' })).toMatchObject({ ok: false })
  })

  it('accepts finite normalized child click coordinates', () => {
    expect(validateChildPageInput({ parentId: 'pg_0123456789abcdef0123456789abcdef', parentClick: { x: 0.42, y: 0.63 } })).toEqual({
      ok: true,
      value: { parentId: 'pg_0123456789abcdef0123456789abcdef', parentClick: { x: 0.42, y: 0.63 } }
    })
  })

  it('rejects invalid parent id and out-of-range child click coordinates', () => {
    expect(validateChildPageInput({ parentId: '../secret', parentClick: { x: 0.42, y: 0.63 } })).toMatchObject({ ok: false })
    expect(validateChildPageInput({ parentId: 'pg_0123456789abcdef0123456789abcdef', parentClick: { x: 1.1, y: 0.63 } })).toMatchObject({ ok: false })
  })
})
