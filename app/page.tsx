'use client'

import { useState } from 'react'
import { ExplainerViewer } from '@/components/ExplainerViewer'
import { HistoryStrip } from '@/components/HistoryStrip'
import { ShareControls } from '@/components/ShareControls'
import { StartScreen } from '@/components/StartScreen'
import { validateRootPageInput } from '@/lib/validation'
import type { Page, ParentClick, StyleKey } from '@/lib/types'

export default function Home() {
  const [query, setQuery] = useState('')
  const [style, setStyle] = useState<StyleKey>('watercolor_book')
  const [pages, setPages] = useState<Page[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitPageRequest(body: unknown): Promise<Page | null> {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const payload: { page?: Page; error?: string } = await response.json()

      if (!response.ok || !payload.page) {
        setError(payload.error ?? '生成失败，换个位置再试。')
        return null
      }

      return payload.page
    } finally {
      setIsGenerating(false)
    }
  }

  async function generateRootPage() {
    const validation = validateRootPageInput({ query, style })

    if (!validation.ok) {
      setError(validation.error)
      return
    }

    const page = await submitPageRequest(validation.value)
    if (page) {
      setPages([page])
      setCurrentIndex(0)
      setShareUrl(null)
    }
  }

  async function generateChildPage(parentPage: Page, parentClick: ParentClick) {
    if (isGenerating) return

    const page = await submitPageRequest({ parentId: parentPage.id, parentClick })
    if (page) {
      setPages((currentPages) => {
        const nextPages = currentPages.slice(0, currentIndex + 1).concat(page)
        setCurrentIndex(nextPages.length - 1)
        return nextPages
      })
      setShareUrl(null)
    }
  }

  async function createShare() {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageIds: pages.map((page) => page.id) })
    })
    const payload: { shareUrl?: string; error?: string } = await response.json()

    if (!response.ok || !payload.shareUrl) {
      setError(payload.error ?? '分享失败。')
      return
    }

    setShareUrl(payload.shareUrl)
  }

  const currentPage = pages[currentIndex]

  return (
    <main className="app-shell">
      <StartScreen
        query={query}
        style={style}
        error={error}
        isGenerating={isGenerating}
        onQueryChange={setQuery}
        onStyleChange={setStyle}
        onGenerate={generateRootPage}
      />
      <div className="workspace-panel">
        <HistoryStrip pages={pages} currentIndex={currentIndex} onSelect={setCurrentIndex} onBack={() => setCurrentIndex((index) => Math.max(0, index - 1))} />
        <ShareControls shareUrl={shareUrl} isDisabled={pages.length === 0} onCreateShare={createShare} />
        {currentPage ? <ExplainerViewer page={currentPage} isGenerating={isGenerating} onDrillDown={generateChildPage} /> : null}
      </div>
    </main>
  )
}
