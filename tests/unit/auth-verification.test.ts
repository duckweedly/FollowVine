import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVerificationCode, createVerificationExpiry, hashVerificationCode, isVerificationCodeExpired, verifyCodeHash } from '@/lib/auth/verification'

function withProductionWithoutAuthSecret<T>(callback: () => T): T {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUTH_SECRET', undefined)
  return callback()
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('verification codes', () => {
  it('creates six-digit codes', () => {
    expect(createVerificationCode()).toMatch(/^\d{6}$/)
  })

  it('hashes and verifies codes', () => {
    const hash = hashVerificationCode('123456', 'pepper')
    expect(verifyCodeHash('123456', hash, 'pepper')).toBe(true)
    expect(verifyCodeHash('000000', hash, 'pepper')).toBe(false)
  })

  it('returns false for malformed hashes', () => {
    expect(verifyCodeHash('123456', 'not-a-sha256-hex-hash', 'pepper')).toBe(false)
  })

  it('returns false when the auth secret is missing', () => {
    withProductionWithoutAuthSecret(() => {
      expect(verifyCodeHash('123456', hashVerificationCode('123456', 'pepper'))).toBe(false)
    })
  })

  it('requires AUTH_SECRET to hash verification codes in production', () => {
    withProductionWithoutAuthSecret(() => {
      expect(() => hashVerificationCode('123456')).toThrow('AUTH_SECRET is required')
    })
  })

  it('creates verification expiry from a base time', () => {
    expect(createVerificationExpiry(new Date('2026-05-24T00:00:00.000Z'), 10).toISOString()).toBe('2026-05-24T00:10:00.000Z')
  })

  it('detects expired codes', () => {
    expect(isVerificationCodeExpired(new Date('2026-05-24T00:00:00.000Z'), new Date('2026-05-24T00:00:01.000Z'))).toBe(true)
    expect(isVerificationCodeExpired(new Date('2026-05-24T00:01:00.000Z'), new Date('2026-05-24T00:00:01.000Z'))).toBe(false)
  })
})
