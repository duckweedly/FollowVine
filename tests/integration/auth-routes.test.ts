import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashVerificationCode } from '@/lib/auth/verification'
import type { findLatestUsableVerificationCode, findUserByLoginIdentifier, saveVerificationCode } from '@/lib/commercial/store'

const createUserWithCreditAccountMock = vi.fn(async () => undefined)
const findUserByLoginIdentifierMock = vi.fn<typeof findUserByLoginIdentifier>(async () => null)
const saveVerificationCodeMock = vi.fn<typeof saveVerificationCode>(async () => undefined)
const findLatestUsableVerificationCodeMock = vi.fn<typeof findLatestUsableVerificationCode>(async () => null)
const consumeVerificationCodeMock = vi.fn(async () => undefined)
const cookieSetMock = vi.fn()

vi.mock('@/lib/commercial/store', () => ({
  createUserWithCreditAccount: createUserWithCreditAccountMock,
  findUserByLoginIdentifier: findUserByLoginIdentifierMock,
  saveVerificationCode: saveVerificationCodeMock,
  findLatestUsableVerificationCode: findLatestUsableVerificationCodeMock,
  consumeVerificationCode: consumeVerificationCodeMock
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock }))
}))

describe('auth routes', () => {
  beforeEach(() => {
    createUserWithCreditAccountMock.mockClear()
    findUserByLoginIdentifierMock.mockReset()
    findUserByLoginIdentifierMock.mockResolvedValue(null)
    saveVerificationCodeMock.mockClear()
    findLatestUsableVerificationCodeMock.mockReset()
    findLatestUsableVerificationCodeMock.mockResolvedValue(null)
    consumeVerificationCodeMock.mockClear()
    cookieSetMock.mockClear()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('request-code rejects invalid login identifiers', async () => {
    const { POST } = await import('@/app/api/auth/request-code/route')
    const response = await POST(new Request('http://test.local/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'not-valid' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请输入有效手机号或邮箱。' })
  })

  it('request-code accepts valid identifiers without delivering a real code', async () => {
    const { POST } = await import('@/app/api/auth/request-code/route')
    const response = await POST(new Request('http://test.local/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: ' User@Example.COM ' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('request-code saves a verification code for the normalized identifier', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'))

    const { POST } = await import('@/app/api/auth/request-code/route')
    const response = await POST(new Request('http://test.local/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: ' User@Example.COM ' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(saveVerificationCodeMock).toHaveBeenCalledWith(expect.objectContaining({
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      expiresAt: '2026-05-24T00:10:00.000Z',
      now: '2026-05-24T00:00:00.000Z'
    }))
    const saved = saveVerificationCodeMock.mock.calls[0][0]
    expect(saved.id).toMatch(/^vc_[a-f0-9]{32}$/)
    expect(saved.codeHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verify-code rejects invalid login identifiers', async () => {
    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'not-valid', code: '123456' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请输入有效手机号或邮箱。' })
    expect(cookieSetMock).not.toHaveBeenCalled()
  })

  it('verify-code rejects non-six-digit codes', async () => {
    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'user@example.com', code: '12345' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请输入六位验证码。' })
    expect(cookieSetMock).not.toHaveBeenCalled()
  })

  it('verify-code rejects unissued verification codes without setting a session cookie', async () => {
    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'user@example.com', code: '123456' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '验证码无效或已过期。' })
    expect(findLatestUsableVerificationCodeMock).toHaveBeenCalledWith('user@example.com', expect.any(String))
    expect(cookieSetMock).not.toHaveBeenCalled()
    expect(findUserByLoginIdentifierMock).not.toHaveBeenCalled()
    expect(createUserWithCreditAccountMock).not.toHaveBeenCalled()
  })

  it('verify-code rejects wrong verification codes without setting a session cookie', async () => {
    findLatestUsableVerificationCodeMock.mockResolvedValueOnce({
      id: 'code_1',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      codeHash: hashVerificationCode('123456'),
      expiresAt: '2026-05-24T00:10:00.000Z',
      consumedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z'
    })

    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'user@example.com', code: '000000' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '验证码无效或已过期。' })
    expect(consumeVerificationCodeMock).not.toHaveBeenCalled()
    expect(cookieSetMock).not.toHaveBeenCalled()
    expect(findUserByLoginIdentifierMock).not.toHaveBeenCalled()
  })

  it('verify-code signs in an existing user and sets a session cookie', async () => {
    findLatestUsableVerificationCodeMock.mockResolvedValueOnce({
      id: 'code_1',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      codeHash: hashVerificationCode('123456'),
      expiresAt: '2026-05-24T00:10:00.000Z',
      consumedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z'
    })
    findUserByLoginIdentifierMock.mockResolvedValueOnce({
      id: 'user_1',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      displayName: null,
      role: 'admin',
      status: 'active',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })

    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'USER@example.com', code: '123456' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(findUserByLoginIdentifierMock).toHaveBeenCalledWith('user@example.com')
    expect(createUserWithCreditAccountMock).not.toHaveBeenCalled()
    expect(consumeVerificationCodeMock).toHaveBeenCalledWith('code_1', expect.any(String))
    expect(cookieSetMock).toHaveBeenCalledWith('fv_session', expect.any(String), expect.objectContaining({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    }))
  })

  it('verify-code rejects disabled existing users without setting a session cookie', async () => {
    findLatestUsableVerificationCodeMock.mockResolvedValueOnce({
      id: 'code_disabled',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      codeHash: hashVerificationCode('123456'),
      expiresAt: '2026-05-24T00:10:00.000Z',
      consumedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z'
    })
    findUserByLoginIdentifierMock.mockResolvedValueOnce({
      id: 'user_disabled',
      loginIdentifier: 'user@example.com',
      loginType: 'email',
      displayName: null,
      role: 'user',
      status: 'disabled',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })

    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'user@example.com', code: '123456' })
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: '账号已被禁用。' })
    expect(consumeVerificationCodeMock).toHaveBeenCalledWith('code_disabled', expect.any(String))
    expect(cookieSetMock).not.toHaveBeenCalled()
  })

  it('verify-code creates a first-login user with a credit account', async () => {
    findLatestUsableVerificationCodeMock.mockResolvedValueOnce({
      id: 'code_new',
      loginIdentifier: '13800138000',
      loginType: 'phone',
      codeHash: hashVerificationCode('123456'),
      expiresAt: '2026-05-24T00:10:00.000Z',
      consumedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z'
    })
    findUserByLoginIdentifierMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user_new',
        loginIdentifier: '13800138000',
        loginType: 'phone',
        displayName: null,
        role: 'user',
        status: 'active',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z'
      })

    const { POST } = await import('@/app/api/auth/verify-code/route')
    const response = await POST(new Request('http://test.local/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: '138 0013 8000', code: '123456' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(createUserWithCreditAccountMock).toHaveBeenCalledWith(expect.objectContaining({
      loginIdentifier: '13800138000',
      loginType: 'phone',
      role: 'user'
    }))
    expect(consumeVerificationCodeMock).toHaveBeenCalledWith('code_new', expect.any(String))
    expect(cookieSetMock).toHaveBeenCalledWith('fv_session', expect.any(String), expect.any(Object))
  })
})
