import type { MouseEvent } from 'react'
import type { Page, ParentClick } from '@/lib/types'

type ExplainerViewerProps = {
  page: Page
  isGenerating?: boolean
  onDrillDown?: (page: Page, click: ParentClick) => void
}

export function ExplainerViewer({ page, isGenerating = false, onDrillDown }: ExplainerViewerProps) {
  function handleClick(event: MouseEvent<HTMLImageElement>) {
    if (!onDrillDown || isGenerating) return

    const rect = event.currentTarget.getBoundingClientRect()
    onDrillDown(page, {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    })
  }

  return (
    <section className="explainer-viewer">
      <div className="viewer-heading">
        <p>点击图中任意位置继续下钻</p>
        <h2>{page.initialQuery ?? '继续图解'}</h2>
      </div>
      <img src={page.imageUrl} alt={page.initialQuery ?? page.id} onClick={handleClick} />
    </section>
  )
}
