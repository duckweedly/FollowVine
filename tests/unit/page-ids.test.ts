import { describe, expect, it } from 'vitest'
import { createChildPageId, createRootPageId, normalizeTopic, roundClickCoordinate } from '@/lib/page-ids'

describe('page identity helpers', () => {
  it('normalizes topic whitespace and casing', () => {
    expect(normalizeTopic('  RAG   是怎么工作的  ')).toBe('rag 是怎么工作的')
  })

  it('creates the same root id for equivalent normalized topics', () => {
    const first = createRootPageId(' RAG 是怎么工作的 ', 'watercolor_book')
    const second = createRootPageId('rag   是怎么工作的', 'watercolor_book')

    expect(first).toBe(second)
    expect(first).toMatch(/^pg_[a-f0-9]{32}$/)
  })

  it('rounds click coordinates to two decimals for child identity', () => {
    expect(roundClickCoordinate(0.424)).toBe(0.42)
    expect(roundClickCoordinate(0.425)).toBe(0.43)
  })

  it('creates the same child id for equivalent rounded click locations', () => {
    const first = createChildPageId('pg_parent', { x: 0.424, y: 0.634 }, 'whiteboard_marker')
    const second = createChildPageId('pg_parent', { x: 0.42, y: 0.63 }, 'whiteboard_marker')

    expect(first).toBe(second)
  })
})
