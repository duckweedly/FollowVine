import { createHmac, timingSafeEqual } from 'node:crypto'
import type { UserRole } from '@/lib/commercial/types'

type SessionPayload = {
  userId: string
  role: UserRole
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function resolveAuthSecret(explicitSecret?: string): string {
  if (explicitSecret) return explicitSecret
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.NODE_ENV !== 'production') return 'dev-secret'
  throw new Error('AUTH_SECRET is required')
}

export function createSessionToken(payload: SessionPayload, secret?: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded, resolveAuthSecret(secret))}`
}

export function verifySessionToken(token: string, secret?: string): SessionPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encoded, signature] = parts
  if (!encoded || !signature) return null

  let resolvedSecret: string
  try {
    resolvedSecret = resolveAuthSecret(secret)
  } catch {
    return null
  }

  const expected = sign(encoded, resolvedSecret)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.userId !== 'string' || payload.userId.length === 0 || (payload.role !== 'user' && payload.role !== 'admin')) return null
    return payload
  } catch {
    return null
  }
}
