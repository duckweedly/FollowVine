import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken, verifySessionToken } from '@/lib/auth/session'

function signEncodedPayload(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url')
}

function withProductionWithoutAuthSecret<T>(callback: () => T): T {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUTH_SECRET', undefined)
  return callback()
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('signed session tokens', () => {
  it('round-trips a valid session token', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'admin' }, 'secret')
    expect(verifySessionToken(token, 'secret')).toEqual({ userId: 'user_1', role: 'admin' })
  })

  it('rejects tokens signed with the wrong secret', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'user' }, 'secret')
    expect(verifySessionToken(token, 'wrong-secret')).toBeNull()
  })

  it('rejects tampered tokens', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'user' }, 'secret')
    expect(verifySessionToken(`${token}x`, 'secret')).toBeNull()
  })

  it('rejects tokens with non-string user IDs', () => {
    const encoded = Buffer.from(JSON.stringify({ userId: 123, role: 'user' }), 'utf8').toString('base64url')
    const token = `${encoded}.${signEncodedPayload(encoded, 'secret')}`

    expect(verifySessionToken(token, 'secret')).toBeNull()
  })

  it('requires AUTH_SECRET to create session tokens in production', () => {
    withProductionWithoutAuthSecret(() => {
      expect(() => createSessionToken({ userId: 'u', role: 'user' })).toThrow('AUTH_SECRET is required')
    })
  })

  it('returns null when verifying without AUTH_SECRET in production', () => {
    const encoded = Buffer.from(JSON.stringify({ userId: 'u', role: 'user' }), 'utf8').toString('base64url')
    const token = `${encoded}.${signEncodedPayload(encoded, 'secret')}`

    withProductionWithoutAuthSecret(() => {
      expect(verifySessionToken(token)).toBeNull()
    })
  })

  it('rejects tokens with extra dot-separated segments', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'user' }, 'secret')
    expect(verifySessionToken(`${token}.extra`, 'secret')).toBeNull()
  })
})
