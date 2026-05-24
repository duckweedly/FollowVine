import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const recordPaymentEventMock = vi.fn(async () => undefined)
const markOrderPaidMock = vi.fn(async () => undefined)
const findOrderByIdMock = vi.fn()
const fulfillPaidOrderMock = vi.fn(async () => ({ fulfilled: true, reason: 'credit_pack' }))
const verifyZpaySignatureMock = vi.fn(() => true)

vi.mock('@/lib/commercial/billing-store', () => ({
  recordPaymentEvent: recordPaymentEventMock,
  markOrderPaid: markOrderPaidMock,
  findOrderById: findOrderByIdMock
}))
vi.mock('@/lib/commercial/fulfillment', () => ({ fulfillPaidOrder: fulfillPaidOrderMock }))
vi.mock('@/lib/commercial/zpay', () => ({ verifyZpaySignature: verifyZpaySignatureMock }))

function notifyRequest(params: Record<string, string>): Request {
  return new Request('http://test.local/api/payments/zpay/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  })
}

describe('zpay notify route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'))
    vi.stubEnv('ZPAY_KEY', 'secret')

    recordPaymentEventMock.mockClear()
    markOrderPaidMock.mockClear()
    findOrderByIdMock.mockReset()
    findOrderByIdMock.mockResolvedValue({ id: 'order_1', amountCents: 990, provider: 'zpay', status: 'pending' })
    fulfillPaidOrderMock.mockClear()
    verifyZpaySignatureMock.mockReset()
    verifyZpaySignatureMock.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('marks paid orders and fulfills them after valid notifications', async () => {
    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    const responseText = await response.text()
    expect(responseText).toBe('success')
    expect(response.status).toBe(200)
    expect(verifyZpaySignatureMock).toHaveBeenCalledWith({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }, 'secret')
    expect(findOrderByIdMock).toHaveBeenCalledWith('order_1')
    expect(recordPaymentEventMock).toHaveBeenCalledWith({
      orderId: 'order_1',
      provider: 'zpay',
      providerTradeNo: 'provider_1',
      eventType: 'notify',
      payload: {
        out_trade_no: 'order_1',
        trade_no: 'provider_1',
        trade_status: 'TRADE_SUCCESS',
        money: '9.90',
        sign: 'valid',
        sign_type: 'MD5'
      },
      isValid: true,
      createdAt: '2026-05-24T00:00:00.000Z'
    })
    expect(markOrderPaidMock).toHaveBeenCalledWith({ orderId: 'order_1', providerTradeNo: 'provider_1', paidAt: '2026-05-24T00:00:00.000Z' })
    expect(fulfillPaidOrderMock).toHaveBeenCalledWith('order_1', '2026-05-24T00:00:00.000Z')
    expect(responseText).not.toContain('secret')
  })

  it('records invalid signatures without marking or fulfilling orders', async () => {
    verifyZpaySignatureMock.mockReturnValueOnce(false)

    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      sign: 'bad',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order_1',
      provider: 'zpay',
      providerTradeNo: 'provider_1',
      eventType: 'notify',
      isValid: false,
      createdAt: '2026-05-24T00:00:00.000Z'
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('records unsuccessful trade status without marking or fulfilling orders', async () => {
    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'WAIT_BUYER_PAY',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order_1',
      providerTradeNo: 'provider_1',
      payload: expect.objectContaining({ trade_status: 'WAIT_BUYER_PAY' }),
      isValid: true
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('records missing order or trade numbers without marking or fulfilling orders', async () => {
    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      trade_status: 'TRADE_SUCCESS',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: null,
      provider: 'zpay',
      providerTradeNo: null,
      eventType: 'notify',
      isValid: true,
      createdAt: '2026-05-24T00:00:00.000Z'
    }))
    expect(findOrderByIdMock).not.toHaveBeenCalled()
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('rejects valid notifications when the order does not exist', async () => {
    findOrderByIdMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_missing',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(findOrderByIdMock).toHaveBeenCalledWith('order_missing')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: null,
      providerTradeNo: 'provider_1',
      payload: expect.objectContaining({ out_trade_no: 'order_missing' }),
      isValid: true
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('rejects valid notifications when the paid amount differs from the order amount', async () => {
    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.89',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order_1',
      providerTradeNo: 'provider_1',
      isValid: true
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('rejects valid notifications for non-zpay orders', async () => {
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', amountCents: 990, provider: 'other', status: 'pending' })

    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order_1',
      providerTradeNo: 'provider_1',
      isValid: true
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it.each(['cancelled', 'failed'])('rejects valid notifications for %s orders', async (status) => {
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', amountCents: 990, provider: 'zpay', status })

    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('fail')
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order_1',
      providerTradeNo: 'provider_1',
      isValid: true
    }))
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).not.toHaveBeenCalled()
  })

  it('accepts repeat paid notifications without marking paid again', async () => {
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', amountCents: 990, provider: 'zpay', status: 'paid' })
    fulfillPaidOrderMock.mockResolvedValueOnce({ fulfilled: false, reason: 'already_fulfilled' })

    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(notifyRequest({
      out_trade_no: 'order_1',
      trade_no: 'provider_1',
      trade_status: 'TRADE_SUCCESS',
      money: '9.90',
      sign: 'valid',
      sign_type: 'MD5'
    }))

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('success')
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(fulfillPaidOrderMock).toHaveBeenCalledWith('order_1', '2026-05-24T00:00:00.000Z')
  })
})
