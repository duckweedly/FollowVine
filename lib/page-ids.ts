import { createHash } from 'node:crypto'
import type { ParentClick, StyleKey } from './types'

const CACHE_VERSION = 'v1'

function hashPageIdentity(input: string): string {
  return `pg_${createHash('sha256').update(input).digest('hex').slice(0, 32)}`
}

export function normalizeTopic(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function roundClickCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

export function createRootPageId(query: string, style: StyleKey): string {
  return hashPageIdentity(['root', CACHE_VERSION, normalizeTopic(query), style].join(':'))
}

export function createChildPageId(parentId: string, parentClick: ParentClick, style: StyleKey): string {
  const x = roundClickCoordinate(parentClick.x).toFixed(2)
  const y = roundClickCoordinate(parentClick.y).toFixed(2)

  return hashPageIdentity(['child', CACHE_VERSION, parentId, x, y, style].join(':'))
}

export function isPageId(value: string): boolean {
  return /^pg_[a-f0-9]{32}$/.test(value)
}
