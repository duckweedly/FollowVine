import type { StyleKey, StylePreset } from './types'

export const STYLE_PRESETS: StylePreset[] = [
  {
    key: 'watercolor_book',
    displayName: '温暖水彩图解书',
    description: 'warm paper, ink outline, soft watercolor, calm explainer book',
    isLaunchVisible: true
  },
  {
    key: 'chinese_science_magazine',
    displayName: '中文科普杂志',
    description: 'modern Chinese science magazine, strong headline, clean editorial layout',
    isLaunchVisible: true
  },
  {
    key: 'whiteboard_marker',
    displayName: '白板手绘',
    description: 'whiteboard marker sketch, simple arrows, clear labels',
    isLaunchVisible: true
  },
  {
    key: 'chalkboard',
    displayName: '黑板粉笔',
    description: 'chalkboard classroom style, experimental',
    isLaunchVisible: false
  }
]

export function getLaunchStyles(): StylePreset[] {
  return STYLE_PRESETS.filter((style) => style.isLaunchVisible)
}

export function getStylePreset(key: string): StylePreset | null {
  return STYLE_PRESETS.find((style) => style.key === key) ?? null
}

export function isLaunchStyle(key: string): key is Exclude<StyleKey, 'chalkboard'> {
  return getStylePreset(key)?.isLaunchVisible === true
}
