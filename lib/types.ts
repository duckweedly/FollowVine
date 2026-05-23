export type StyleKey = 'watercolor_book' | 'chinese_science_magazine' | 'whiteboard_marker' | 'chalkboard'

export type ParentClick = {
  x: number
  y: number
}

export type Page = {
  id: string
  imageUrl: string
  parentId: string | null
  parentClick: ParentClick | null
  initialQuery: string | null
  style: StyleKey
  createdAt: string
}

export type ExplainerPath = {
  pages: Page[]
  currentIndex: number
  shareId: string | null
  createdAt: string
  updatedAt: string
}

export type StylePreset = {
  key: StyleKey
  displayName: string
  description: string
  isLaunchVisible: boolean
}

export type ShareLink = {
  shareId: string
  pageIds: string[]
  createdAt: string
}

export type UIGenerationState = {
  pages: Page[]
  currentIndex: number
  isGenerating: boolean
  error: string | null
}
