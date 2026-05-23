import type { ParentClick, StyleKey } from './types'
import { isPageId, normalizeTopic } from './page-ids'
import { isLaunchStyle } from './styles'

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

type RootPageInput = {
  query: string
  style: Exclude<StyleKey, 'chalkboard'>
}

type ChildPageInput = {
  parentId: string
  parentClick: ParentClick
}

const UNSAFE_TOPIC_PATTERNS = [/炸弹/, /爆炸物/, /自杀/, /色情/, /毒品/, /违法/]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnsafeTopic(query: string): boolean {
  return UNSAFE_TOPIC_PATTERNS.some((pattern) => pattern.test(query))
}

export function validateRootPageInput(input: unknown): ValidationResult<RootPageInput> {
  if (!isRecord(input) || typeof input.query !== 'string' || typeof input.style !== 'string') {
    return { ok: false, error: '请输入有效的知识主题。' }
  }

  const query = normalizeTopic(input.query)

  if (query.length < 1 || query.length > 300) {
    return { ok: false, error: '请输入 1-300 个字符的知识主题。' }
  }

  if (isUnsafeTopic(query)) {
    return { ok: false, error: '请选择一个适合学习的知识主题。' }
  }

  if (!isLaunchStyle(input.style)) {
    return { ok: false, error: '请选择一个可用的视觉风格。' }
  }

  return { ok: true, value: { query, style: input.style } }
}

export function validateChildPageInput(input: unknown): ValidationResult<ChildPageInput> {
  if (!isRecord(input) || typeof input.parentId !== 'string' || !isRecord(input.parentClick)) {
    return { ok: false, error: '请选择有效的图中位置。' }
  }

  const { x, y } = input.parentClick

  if (!isPageId(input.parentId) || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return { ok: false, error: '请选择有效的图中位置。' }
  }

  return { ok: true, value: { parentId: input.parentId, parentClick: { x, y } } }
}
