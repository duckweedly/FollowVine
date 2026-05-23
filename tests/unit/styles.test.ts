import { describe, expect, it } from 'vitest'
import { getLaunchStyles, getStylePreset, isLaunchStyle } from '@/lib/styles'

describe('style presets', () => {
  it('exposes exactly the three launch-visible styles', () => {
    expect(getLaunchStyles().map((style) => style.key)).toEqual([
      'watercolor_book',
      'chinese_science_magazine',
      'whiteboard_marker'
    ])
  })

  it('keeps chalkboard hidden for V1 launch selection', () => {
    expect(isLaunchStyle('chalkboard')).toBe(false)
    expect(getStylePreset('chalkboard')?.isLaunchVisible).toBe(false)
  })

  it('returns no preset for unknown style keys', () => {
    expect(getStylePreset('pixel_art')).toBeNull()
  })
})
