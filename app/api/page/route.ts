import { NextResponse } from 'next/server'
import { createChildPageId, createRootPageId, roundClickCoordinate } from '@/lib/page-ids'
import { findPageById, savePage } from '@/lib/page-store'
import { validateChildPageInput, validateRootPageInput } from '@/lib/validation'
import { generateChildPageImage, generateRootPageImage } from '@/lib/image-generation'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasRootFields(body: unknown): boolean {
  return isRecord(body) && ('query' in body || 'style' in body)
}

function hasChildFields(body: unknown): boolean {
  return isRecord(body) && ('parentId' in body || 'parentClick' in body)
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null)
  const isRoot = hasRootFields(body)
  const isChild = hasChildFields(body)

  if (isRoot && isChild) {
    return NextResponse.json({ error: '请求只能是根页面或子页面之一。' }, { status: 400 })
  }

  try {
    if (isChild) {
      const childInput = validateChildPageInput(body)

      if (!childInput.ok) {
        return NextResponse.json({ error: childInput.error }, { status: 400 })
      }

      const parentPage = await findPageById(childInput.value.parentId)

      if (!parentPage) {
        return NextResponse.json({ error: '找不到上一页。' }, { status: 404 })
      }

      const roundedClick = {
        x: roundClickCoordinate(childInput.value.parentClick.x),
        y: roundClickCoordinate(childInput.value.parentClick.y)
      }
      const childPageId = createChildPageId(parentPage.id, roundedClick, parentPage.style)
      const cachedChild = await findPageById(childPageId)

      if (cachedChild) {
        return NextResponse.json({ page: cachedChild })
      }

      const childPage = await generateChildPageImage(parentPage, childInput.value.parentClick)
      await savePage(childPage)

      return NextResponse.json({ page: childPage })
    }

    const rootInput = validateRootPageInput(body)

    if (!rootInput.ok) {
      return NextResponse.json({ error: rootInput.error }, { status: 400 })
    }

    const pageId = createRootPageId(rootInput.value.query, rootInput.value.style)
    const cachedPage = await findPageById(pageId)

    if (cachedPage) {
      return NextResponse.json({ page: cachedPage })
    }

    const page = await generateRootPageImage(rootInput.value.query, rootInput.value.style)
    await savePage(page)

    return NextResponse.json({ page })
  } catch {
    return NextResponse.json({ error: '生成失败，换个位置再试。' }, { status: 502 })
  }
}
