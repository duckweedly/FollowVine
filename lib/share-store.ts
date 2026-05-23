import { randomBytes } from 'node:crypto'
import type { ShareLink } from './types'
import { query } from './db'

type ShareRow = {
  share_id: string
  page_ids: string[]
  created_at: Date | string
}

function mapShareRow(row: ShareRow): ShareLink {
  return {
    shareId: row.share_id,
    pageIds: row.page_ids,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  }
}

export function createShareId(): string {
  return `sh_${randomBytes(8).toString('hex')}`
}

export function isShareId(value: string): boolean {
  return /^sh_[a-f0-9]{16}$/.test(value)
}

export async function findShareLink(shareId: string): Promise<ShareLink | null> {
  const result = await query<ShareRow>('select share_id, page_ids, created_at from share_links where share_id = $1', [shareId])
  return result.rows[0] ? mapShareRow(result.rows[0]) : null
}

export async function saveShareLink(share: ShareLink): Promise<void> {
  await query(
    `insert into share_links (share_id, page_ids, created_at)
     values ($1, $2, $3)
     on conflict (share_id) do update set
       page_ids = excluded.page_ids,
       created_at = excluded.created_at`,
    [share.shareId, share.pageIds, share.createdAt]
  )
}
