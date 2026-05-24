/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { findUserById } from '@/lib/commercial/store'

const cookieGetMock = vi.fn()
const redirectMock = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`)
})
const findUserByIdMock = vi.fn<typeof findUserById>(async () => null)

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock }))
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock
}))

vi.mock('@/lib/commercial/store', () => ({
  findUserById: findUserByIdMock
}))

vi.mock('@/components/admin/AdminNav', () => ({
  AdminNav: () => <nav aria-label="Admin navigation">Admin nav</nav>
}))

describe('AdminLayout', () => {
  beforeEach(() => {
    cookieGetMock.mockReset()
    redirectMock.mockClear()
    findUserByIdMock.mockReset()
    findUserByIdMock.mockResolvedValue(null)
  })

  it('redirects users without a session to login', async () => {
    const { default: AdminLayout } = await import('@/app/admin/layout')

    try {
      await Promise.resolve(AdminLayout({ children: <p>Secret admin content</p> }))
    } catch (error) {
      expect(error).toEqual(new Error('redirect:/login'))
    }
    expect(redirectMock).toHaveBeenCalledWith('/login')
    expect(findUserByIdMock).not.toHaveBeenCalled()
  })

  it('redirects active normal users to login', async () => {
    const { createSessionToken } = await import('@/lib/auth/session')
    cookieGetMock.mockReturnValue({ value: createSessionToken({ userId: 'user_1', role: 'user' }) })
    findUserByIdMock.mockResolvedValueOnce({
      id: 'user_1',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      displayName: null,
      role: 'user',
      status: 'active',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })
    const { default: AdminLayout } = await import('@/app/admin/layout')

    try {
      await Promise.resolve(AdminLayout({ children: <p>Secret admin content</p> }))
    } catch (error) {
      expect(error).toEqual(new Error('redirect:/login'))
    }
    expect(findUserByIdMock).toHaveBeenCalledWith('user_1')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('renders active admins without redirecting', async () => {
    const { createSessionToken } = await import('@/lib/auth/session')
    cookieGetMock.mockReturnValue({ value: createSessionToken({ userId: 'admin_1', role: 'admin' }) })
    findUserByIdMock.mockResolvedValueOnce({
      id: 'admin_1',
      loginIdentifier: 'admin@example.com',
      loginType: 'email',
      displayName: null,
      role: 'admin',
      status: 'active',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })
    const { default: AdminLayout } = await import('@/app/admin/layout')

    render(await AdminLayout({ children: <p>Secret admin content</p> }))

    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByText('Admin Console')).toBeInTheDocument()
    expect(screen.getByText('Secret admin content')).toBeInTheDocument()
  })
})
