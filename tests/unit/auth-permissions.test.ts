import { describe, expect, it } from 'vitest'
import { canAccessAdmin } from '@/lib/auth/permissions'

describe('admin permissions', () => {
  it('allows active admins only', () => {
    expect(canAccessAdmin({ role: 'admin', status: 'active' })).toBe(true)
    expect(canAccessAdmin({ role: 'user', status: 'active' })).toBe(false)
    expect(canAccessAdmin({ role: 'admin', status: 'disabled' })).toBe(false)
  })
})
