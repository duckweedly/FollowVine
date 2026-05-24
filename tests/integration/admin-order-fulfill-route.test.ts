import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUserFromSessionMock = vi.fn()
const canAccessAdminMock = vi.fn(() => true)
const findOrderByIdMock = vi.fn()
const markOrderPaidMock = vi.fn(async () => undefined)
const recordPaymentEventMock = vi.fn(async () => undefined)
const fulfillPaidOrderMock = vi.fn(async () => ({ fulfilled: true, reason: 'credit_pack' }))
const cookiesGetMock = vi.fn()
const cookiesMock = vi.fn(async () => ({ get: cookiesGetMock }))

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: getCurrentUserFromSessionMock }))
vi.mock('@/lib/auth/permissions', () => ({ canAccessAdmin: canAccessAdminMock }))
vi.mock('@/lib/commercial/billing-store', () => ({
  findOrderById: findOrderByIdMock,
  markOrderPaid: markOrderPaidMock,
  recordPaymentEvent: recordPaymentEventMock
}))
vi.mock('@/lib/commercial/fulfillment', () => ({ fulfillPaidOrder: fulfillPaidOrderMock }))
vi.mock('next/headers', () => ({ cookies: cookiesMock }))

function request(body: unknown): Request {
  return new Request('http://test.local/api/admin/orders/fulfill', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function adminUser() {
  return { id: 'admin_1', role: 'admin', status: 'active' }
}

describe('admin order fulfillment route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'))

    getCurrentUserFromSessionMock.mockReset()
    getCurrentUserFromSessionMock.mockResolvedValue(adminUser())
    canAccessAdminMock.mockReset()
    canAccessAdminMock.mockReturnValue(true)
    findOrderByIdMock.mockReset()
    findOrderByIdMock.mockResolvedValue({ id: 'order_1', provider: 'zpay', status: 'pending' })
    markOrderPaidMock.mockClear()
    recordPaymentEventMock.mockClear()
    fulfillPaidOrderMock.mockClear()
    fulfillPaidOrderMock.mockResolvedValue({ fulfilled: true, reason: 'credit_pack' })
    cookiesGetMock.mockReset()
    cookiesGetMock.mockReturnValue({ value: 'session-token' })
    cookiesMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('marks and fulfills pending orders manually', async () => {
    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request({ orderId: 'order_1', providerTradeNo: 'manual_1', reason: 'manual correction' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, fulfilled: true, reason: 'credit_pack' })
    expect(cookiesGetMock).toHaveBeenCalledWith('fv_session')
    expect(getCurrentUserFromSessionMock).toHaveBeenCalledWith('session-token')
    expect(canAccessAdminMock).toHaveBeenCalledWith(adminUser())
    expect(findOrderByIdMock).toHaveBeenCalledWith('order_1')
    expect(recordPaymentEventMock).toHaveBeenCalledWith({
      orderId: 'order_1',
      provider: 'zpay',
      providerTradeNo: 'manual_1',
      eventType: 'manual_correction',
      payload: { reason: 'manual correction', adminId: 'admin_1' },
      isValid: true,
      createdAt: '2026-05-24T00:00:00.000Z'
    })
    expect(markOrderPaidMock).toHaveBeenCalledWith({ orderId: 'order_1', providerTradeNo: 'manual_1', paidAt: '2026-05-24T00:00:00.000Z' })
    expect(fulfillPaidOrderMock).toHaveBeenCalledWith('order_1', '2026-05-24T00:00:00.000Z')
  })

  it('does not mark already paid orders again during manual fulfillment', async () => {
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', provider: 'zpay', status: 'paid' })
    fulfillPaidOrderMock.mockResolvedValueOnce({ fulfilled: false, reason: 'already_fulfilled' })

    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request({ orderId: 'order_1', providerTradeNo: 'manual_1', reason: 'manual correction' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, fulfilled: false, reason: 'already_fulfilled' })
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).toHaveBeenCalledWith('order_1', '2026-05-24T00:00:00.000Z')
  })

  it('rejects non-admin users before recording events', async () => {
    canAccessAdminMock.mockReturnValueOnce(false)

    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request({ orderId: 'order_1', providerTradeNo: 'manual_1', reason: 'manual correction' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: '需要管理员权限。' })
    expect(recordPaymentEventMock).not.toHaveBeenCalled()
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ orderId: '', providerTradeNo: '', reason: '' }],
    [{ orderId: {}, providerTradeNo: 'manual_1', reason: 'manual correction' }],
    [{ orderId: 'order_1', providerTradeNo: true, reason: 'manual correction' }],
    [{ orderId: 'order_1', providerTradeNo: 'manual_1', reason: ['manual correction'] }]
  ])('rejects malformed manual fulfillment input %#', async (body) => {
    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '手动履约参数不可用。' })
    expect(recordPaymentEventMock).not.toHaveBeenCalled()
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    findOrderByIdMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request({ orderId: 'order_missing', providerTradeNo: 'manual_1', reason: 'manual correction' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '订单不存在。' })
    expect(recordPaymentEventMock).not.toHaveBeenCalled()
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it.each(['cancelled', 'failed'])('rejects %s orders', async (status) => {
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', provider: 'zpay', status })

    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(request({ orderId: 'order_1', providerTradeNo: 'manual_1', reason: 'manual correction' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '订单状态不可履约。' })
    expect(recordPaymentEventMock).not.toHaveBeenCalled()
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })
})
