import { findPagesByIds } from '@/lib/page-store'
import { findShareLink, isShareId } from '@/lib/share-store'
import type { Page, ShareLink } from '@/lib/types'

export async function getSharedPages(shareId: string): Promise<{ share: ShareLink; pages: Page[] } | null> {
  if (!isShareId(shareId)) return null

  const share = await findShareLink(shareId)
  if (!share) return null

  const pages = await findPagesByIds(share.pageIds)
  if (pages.length !== share.pageIds.length) return null

  return { share, pages }
}

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const shared = await getSharedPages(shareId)

  if (!shared) {
    return <main>分享内容暂不可用。</main>
  }

  return (
    <main>
      <h1>FollowVine 分享</h1>
      {shared.pages.map((page, index) => (
        <section key={`${page.id}-${index}`}>
          <h2>{page.initialQuery ?? `第 ${index + 1} 页`}</h2>
          <img src={page.imageUrl} alt={page.initialQuery ?? page.id} />
        </section>
      ))}
    </main>
  )
}
