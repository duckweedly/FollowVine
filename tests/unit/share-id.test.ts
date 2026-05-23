import { describe, expect, it } from 'vitest'
import { isShareId } from '@/lib/share-store'

describe('share id validation', () => {
  it('accepts generated share ids and rejects arbitrary path segments', () => {
    expect(isShareId('sh_0123456789abcdef')).toBe(true)
    expect(isShareId('../secret')).toBe(false)
    expect(isShareId('share-demo')).toBe(false)
  })
})
