import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/lib/commercial/types'

const verifySessionTokenMock = vi.fn()
const findUserByIdMock = vi.fn()

vi.mock('@/lib/auth/session', () => ({ verifySessionToken: verifySessionTokenMock }))
vi.mock('@/lib/commercial/store', () => ({ findUserById: findUserByIdMock }))

function activeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_1',
    loginIdentifier: 'user@example.com',
    loginType: 'email',
    displayName: null,
    role: 'user',
    status: 'active',
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
    ...overrides
  }
}

describe('current user helper', () => {
  beforeEach(() => {
    verifySessionTokenMock.mockReset()
    findUserByIdMock.mockReset()
  })

  it('returns null for missing session tokens', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')

    await expect(getCurrentUserFromSession(null)).resolves.toBeNull()
    await expect(getCurrentUserFromSession(undefined)).resolves.toBeNull()
    await expect(getCurrentUserFromSession('')).resolves.toBeNull()
    expect(verifySessionTokenMock).not.toHaveBeenCalled()
    expect(findUserByIdMock).not.toHaveBeenCalled()
  })

  it('returns null for invalid session tokens', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')
    verifySessionTokenMock.mockReturnValueOnce(null)

    await expect(getCurrentUserFromSession('bad-token')).resolves.toBeNull()
    expect(verifySessionTokenMock).toHaveBeenCalledWith('bad-token')
    expect(findUserByIdMock).not.toHaveBeenCalled()
  })

  it('returns null when the session user no longer exists', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')
    verifySessionTokenMock.mockReturnValueOnce({ userId: 'user_missing', role: 'user' })
    findUserByIdMock.mockResolvedValueOnce(null)

    await expect(getCurrentUserFromSession('token')).resolves.toBeNull()
    expect(findUserByIdMock).toHaveBeenCalledWith('user_missing')
  })

  it('returns null for disabled users', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')
    verifySessionTokenMock.mockReturnValueOnce({ userId: 'user_disabled', role: 'user' })
    findUserByIdMock.mockResolvedValueOnce(activeUser({ id: 'user_disabled', status: 'disabled' }))

    await expect(getCurrentUserFromSession('token')).resolves.toBeNull()
  })

  it('returns active users loaded from the session user id', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')
    const user = activeUser({ id: 'user_active', role: 'admin' })
    verifySessionTokenMock.mockReturnValueOnce({ userId: 'user_active', role: 'admin' })
    findUserByIdMock.mockResolvedValueOnce(user)

    await expect(getCurrentUserFromSession('token')).resolves.toBe(user)
    expect(findUserByIdMock).toHaveBeenCalledWith('user_active')
  })
})
