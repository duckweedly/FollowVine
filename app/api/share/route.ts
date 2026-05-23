import { NextResponse } from 'next/server'
import { isPageId } from '@/lib/page-ids'
import { findPagesByIds } from '@/lib/page-store'
import { createShareId, saveShareLink } from '@/lib/share-store'
import type { ShareLink } from '@/lib/types'

function isShareRequest(value: unknown): value is { pageIds: string[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as { pageIds?: unknown }).pageIds)
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null)

  if (!isShareRequest(body) || body.pageIds.length === 0 || !body.pageIds.every((pageId) => typeof pageId === 'string' && isPageId(pageId))) {
    return NextResponse.json({ error: '没有可分享的图解路径。' }, { status: 400 })
  }

  const pages = await findPagesByIds(body.pageIds)
  if (pages.length !== body.pageIds.length) {
    return NextResponse.json({ error: '没有可分享的图解路径。' }, { status: 400 })
  }

  const share: ShareLink = {
    shareId: createShareId(),
    pageIds: body.pageIds,
    createdAt: new Date().toISOString()
  }

  await saveShareLink(share)

  return NextResponse.json({ shareUrl: `/share/${share.shareId}` })
}
