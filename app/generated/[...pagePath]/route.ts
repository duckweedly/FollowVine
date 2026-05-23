import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { isPageId } from '@/lib/page-ids'

type RouteContext = {
  params: Promise<{ pagePath?: string[] }>
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { pagePath } = await context.params
  const fileName = pagePath?.[0]
  const pageId = fileName?.endsWith('.png') ? fileName.slice(0, -4) : null

  if (!pageId || pagePath?.length !== 1 || !isPageId(pageId)) {
    return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
  }

  try {
    const data = await readFile(join(process.cwd(), 'storage/generated', `${pageId}.png`))
    return new Response(data, { headers: { 'content-type': 'image/png' } })
  } catch {
    return NextResponse.json({ error: 'Generated image not found' }, { status: 404 })
  }
}
