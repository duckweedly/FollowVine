import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

export function createVerificationCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, '0')
}

function resolveAuthSecret(explicitSecret?: string): string {
  if (explicitSecret) return explicitSecret
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.NODE_ENV !== 'production') return 'dev-secret'
  throw new Error('AUTH_SECRET is required')
}

export function hashVerificationCode(code: string, pepper?: string): string {
  return createHash('sha256').update(`${code}:${resolveAuthSecret(pepper)}`).digest('hex')
}

export function verifyCodeHash(code: string, hash: string, pepper?: string): boolean {
  try {
    if (!/^[a-f0-9]{64}$/i.test(hash)) return false
    const expected = Buffer.from(hashVerificationCode(code, pepper), 'hex')
    const actual = Buffer.from(hash, 'hex')
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function isVerificationCodeExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function createVerificationExpiry(now = new Date(), ttlMinutes = 10): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000)
}
