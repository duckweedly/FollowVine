import { describe, expect, it } from 'vitest'
import { getClickPixelPosition } from '@/lib/red-circle'

describe('red circle helpers', () => {
  it('maps normalized click coordinates to image pixels', () => {
    expect(getClickPixelPosition({ x: 0.5, y: 0.25 }, { width: 1600, height: 900 })).toEqual({ x: 800, y: 225 })
  })
})
