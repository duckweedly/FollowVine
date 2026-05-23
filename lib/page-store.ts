import type { Page, ParentClick, StyleKey } from './types'
import { query } from './db'

type PageRow = {
  id: string
  image_url: string
  parent_id: string | null
  parent_click: ParentClick | null
  initial_query: string | null
  style: StyleKey
  created_at: Date | string
}

function mapPageRow(row: PageRow): Page {
  return {
    id: row.id,
    imageUrl: row.image_url,
    parentId: row.parent_id,
    parentClick: row.parent_click,
    initialQuery: row.initial_query,
    style: row.style,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  }
}

export async function findPageById(id: string): Promise<Page | null> {
  const result = await query<PageRow>('select id, image_url, parent_id, parent_click, initial_query, style, created_at from pages where id = $1', [id])
  return result.rows[0] ? mapPageRow(result.rows[0]) : null
}

export async function findPagesByIds(ids: string[]): Promise<Page[]> {
  if (ids.length === 0) return []

  const result = await query<PageRow>('select id, image_url, parent_id, parent_click, initial_query, style, created_at from pages where id = any($1::text[])', [ids])
  const pagesById = new Map(result.rows.map((row) => [row.id, mapPageRow(row)]))

  return ids.flatMap((id) => {
    const page = pagesById.get(id)
    return page ? [page] : []
  })
}

export async function savePage(page: Page): Promise<void> {
  await query(
    `insert into pages (id, image_url, parent_id, parent_click, initial_query, style, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       image_url = excluded.image_url,
       parent_id = excluded.parent_id,
       parent_click = excluded.parent_click,
       initial_query = excluded.initial_query,
       style = excluded.style,
       created_at = excluded.created_at`,
    [page.id, page.imageUrl, page.parentId, page.parentClick, page.initialQuery, page.style, page.createdAt]
  )
}
