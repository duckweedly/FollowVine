import type { Page } from '@/lib/types'

type HistoryStripProps = {
  pages: Page[]
  currentIndex: number
  onSelect: (index: number) => void
  onBack: () => void
}

export function HistoryStrip({ pages, currentIndex, onSelect, onBack }: HistoryStripProps) {
  if (pages.length === 0) return null

  return (
    <nav aria-label="图解历史">
      <button type="button" onClick={onBack} disabled={currentIndex === 0}>
        返回上一页
      </button>
      {pages.map((page, index) => (
        <button key={`${page.id}-${index}`} type="button" aria-current={index === currentIndex ? 'page' : undefined} onClick={() => onSelect(index)}>
          第 {index + 1} 页
        </button>
      ))}
    </nav>
  )
}
