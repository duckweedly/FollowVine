import { describe, expect, it } from 'vitest'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'

describe('login identity normalization', () => {
  it('normalizes email identifiers', () => {
    expect(normalizeLoginIdentifier('  User@Example.COM ')).toEqual({ loginType: 'email', loginIdentifier: 'user@example.com' })
  })

  it('normalizes phone identifiers', () => {
    expect(normalizeLoginIdentifier(' 138 0013 8000 ')).toEqual({ loginType: 'phone', loginIdentifier: '13800138000' })
  })

  it('rejects invalid identifiers', () => {
    expect(() => normalizeLoginIdentifier('not-valid')).toThrow('Enter a valid phone number or email')
  })
})
