import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUserFromSessionMock = vi.fn()
const canAccessAdminMock = vi.fn(() => true)
const applyAdminCreditAdjustmentMock = vi.fn(() => ({
  balanceAfter: 15,
  ledger: {
    type: 'admin_adjustment',
    amount: 5,
    balanceAfter: 15,
    referenceType: 'admin_adjustment',
    referenceId: null,
    reason: 'support correction'
  }
}))
const txQueryMock = vi.fn()
const withTransactionMock = vi.fn(async (callback) => callback({ query: txQueryMock }))
const cookiesGetMock = vi.fn()
const cookiesMock = vi.fn(async () => ({ get: cookiesGetMock }))

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: getCurrentUserFromSessionMock }))
vi.mock('@/lib/auth/permissions', () => ({ canAccessAdmin: canAccessAdminMock }))
vi.mock('@/lib/commercial/credits', () => ({ applyAdminCreditAdjustment: applyAdminCreditAdjustmentMock }))
vi.mock('@/lib/db', () => ({ withTransaction: withTransactionMock }))
vi.mock('next/headers', () => ({ cookies: cookiesMock }))

function request(body: unknown): Request {
  return new Request('http://test.local/api/admin/credits/adjust', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function adminUser() {
  return { id: 'admin_1', role: 'admin', status: 'active' }
}

describe('admin credit adjustment route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'))

    getCurrentUserFromSessionMock.mockReset()
    getCurrentUserFromSessionMock.mockResolvedValue(adminUser())
    canAccessAdminMock.mockReset()
    canAccessAdminMock.mockReturnValue(true)
    applyAdminCreditAdjustmentMock.mockClear()
    applyAdminCreditAdjustmentMock.mockReturnValue({
      balanceAfter: 15,
      ledger: {
        type: 'admin_adjustment',
        amount: 5,
        balanceAfter: 15,
        referenceType: 'admin_adjustment',
        referenceId: null,
        reason: 'support correction'
      }
    })
    txQueryMock.mockReset()
    txQueryMock.mockResolvedValue({ rows: [] })
    txQueryMock.mockResolvedValueOnce({ rows: [{ balance: 10 }] })
    withTransactionMock.mockClear()
    cookiesGetMock.mockReset()
    cookiesGetMock.mockReturnValue({ value: 'session-token' })
    cookiesMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('accepts admin credit adjustments with reasons', async () => {
    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(request({ userId: 'user_1', amount: 5, reason: 'support correction' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(cookiesGetMock).toHaveBeenCalledWith('fv_session')
    expect(getCurrentUserFromSessionMock).toHaveBeenCalledWith('session-token')
    expect(canAccessAdminMock).toHaveBeenCalledWith(adminUser())
    expect(withTransactionMock).toHaveBeenCalledOnce()
    expect(txQueryMock).toHaveBeenNthCalledWith(1, 'select balance from credit_accounts where user_id = $1 for update', ['user_1'])
    expect(applyAdminCreditAdjustmentMock).toHaveBeenCalledWith({ balance: 10, amount: 5, reason: 'support correction' })
    expect(txQueryMock).toHaveBeenNthCalledWith(2, 'update credit_accounts set balance = $1, updated_at = $2 where user_id = $3', [15, '2026-05-24T00:00:00.000Z', 'user_1'])
    expect(txQueryMock.mock.calls[2][0]).toContain('insert into credit_ledger_entries')
    expect(txQueryMock.mock.calls[2][1]).toEqual([
      expect.stringMatching(/^cle_[a-f0-9]{32}$/),
      'user_1',
      'admin_adjustment',
      5,
      15,
      'admin_adjustment',
      null,
      'support correction',
      '2026-05-24T00:00:00.000Z'
    ])
  })

  it('rejects non-admin users before changing credits', async () => {
    canAccessAdminMock.mockReturnValueOnce(false)

    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(request({ userId: 'user_1', amount: 5, reason: 'support correction' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: '需要管理员权限。' })
    expect(withTransactionMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ userId: '', amount: 'not-a-number', reason: '' }],
    [{ userId: {}, amount: 5, reason: 'support correction' }],
    [{ userId: 'user_1', amount: true, reason: 'support correction' }],
    [{ userId: 'user_1', amount: 5, reason: ['support correction'] }]
  ])('rejects malformed credit adjustment input %#', async (body) => {
    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(request(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '调整参数不可用。' })
    expect(withTransactionMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the user credit account is missing', async () => {
    txQueryMock.mockReset()
    txQueryMock.mockResolvedValueOnce({ rows: [] })

    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(request({ userId: 'user_missing', amount: 5, reason: 'support correction' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '积分账户不存在。' })
    expect(applyAdminCreditAdjustmentMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the adjustment would make the balance negative', async () => {
    applyAdminCreditAdjustmentMock.mockImplementationOnce(() => {
      throw new Error('Credit balance cannot be negative')
    })

    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(request({ userId: 'user_1', amount: -20, reason: 'support correction' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '调整后积分不能为负。' })
    expect(txQueryMock).toHaveBeenCalledTimes(1)
  })
})
