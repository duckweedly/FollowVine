import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUserFromSessionMock = vi.fn()
const createOrderMock = vi.fn(async () => undefined)
const findCreditPackByIdMock = vi.fn()
const findMembershipPlanByIdMock = vi.fn()
const buildZpayPaymentUrlMock = vi.fn(() => 'https://pay.example.com/submit.php?signed=1')
const cookiesGetMock = vi.fn()
const cookiesMock = vi.fn(async () => ({ get: cookiesGetMock }))

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: getCurrentUserFromSessionMock }))
vi.mock('@/lib/commercial/billing-store', () => ({
  createOrder: createOrderMock,
  findCreditPackById: findCreditPackByIdMock,
  findMembershipPlanById: findMembershipPlanByIdMock
}))
vi.mock('@/lib/commercial/zpay', () => ({ buildZpayPaymentUrl: buildZpayPaymentUrlMock }))
vi.mock('next/headers', () => ({ cookies: cookiesMock }))

function request(body: unknown): Request {
  return new Request('http://test.local/api/billing/orders', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function activeUser() {
  return { id: 'user_1', role: 'user', status: 'active' }
}

describe('billing order route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'))
    vi.stubEnv('ZPAY_GATEWAY_URL', 'https://pay.example.com/submit.php')
    vi.stubEnv('ZPAY_PID', '1001')
    vi.stubEnv('ZPAY_KEY', 'secret')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')

    getCurrentUserFromSessionMock.mockReset()
    getCurrentUserFromSessionMock.mockResolvedValue(activeUser())
    createOrderMock.mockClear()
    findCreditPackByIdMock.mockReset()
    findCreditPackByIdMock.mockResolvedValue({ id: 'pack_1', name: 'Starter Credits', priceCents: 990 })
    findMembershipPlanByIdMock.mockReset()
    findMembershipPlanByIdMock.mockResolvedValue(null)
    buildZpayPaymentUrlMock.mockClear()
    buildZpayPaymentUrlMock.mockReturnValue('https://pay.example.com/submit.php?signed=1')
    cookiesGetMock.mockReset()
    cookiesGetMock.mockReturnValue({ value: 'session-token' })
    cookiesMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns 401 when the session is missing or inactive', async () => {
    getCurrentUserFromSessionMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'credit_pack', productId: 'pack_1' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: '请先登录。' })
    expect(cookiesGetMock).toHaveBeenCalledWith('fv_session')
    expect(getCurrentUserFromSessionMock).toHaveBeenCalledWith('session-token')
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(createOrderMock).not.toHaveBeenCalled()
    expect(buildZpayPaymentUrlMock).not.toHaveBeenCalled()
  })

  it('creates credit-pack payment orders', async () => {
    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'credit_pack', productId: 'pack_1', paymentType: 'alipay' }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ orderId: expect.stringMatching(/^order_[a-f0-9]{32}$/), paymentUrl: 'https://pay.example.com/submit.php?signed=1' })
    expect(JSON.stringify(payload)).not.toContain('secret')
    expect(findCreditPackByIdMock).toHaveBeenCalledWith('pack_1')
    expect(findMembershipPlanByIdMock).not.toHaveBeenCalled()
    expect(createOrderMock).toHaveBeenCalledWith({
      id: payload.orderId,
      userId: 'user_1',
      orderType: 'credit_pack',
      amountCents: 990,
      productId: 'pack_1',
      provider: 'zpay',
      now: '2026-05-24T00:00:00.000Z'
    })
    expect(buildZpayPaymentUrlMock).toHaveBeenCalledWith({
      gatewayUrl: 'https://pay.example.com/submit.php',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: payload.orderId,
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990
    })
  })

  it('creates membership orders and defaults payment type to alipay', async () => {
    findCreditPackByIdMock.mockResolvedValueOnce(null)
    findMembershipPlanByIdMock.mockResolvedValueOnce({ id: 'plan_1', name: 'Pro Monthly', priceCents: 2990 })

    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'membership', productId: 'plan_1' }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(findMembershipPlanByIdMock).toHaveBeenCalledWith('plan_1')
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      id: payload.orderId,
      userId: 'user_1',
      orderType: 'membership',
      amountCents: 2990,
      productId: 'plan_1',
      provider: 'zpay'
    }))
    expect(buildZpayPaymentUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      paymentType: 'alipay',
      outTradeNo: payload.orderId,
      name: 'Pro Monthly',
      amountCents: 2990
    }))
  })

  it('returns 400 when the product type is unsupported', async () => {
    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'unknown', productId: 'pack_1' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '商品不可用。' })
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(findMembershipPlanByIdMock).not.toHaveBeenCalled()
    expect(createOrderMock).not.toHaveBeenCalled()
  })

  it('returns 400 before creating orders when the payment type is unsupported', async () => {
    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'credit_pack', productId: 'pack_1', paymentType: 'wechat' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '支付方式不可用。' })
    expect(createOrderMock).not.toHaveBeenCalled()
    expect(buildZpayPaymentUrlMock).not.toHaveBeenCalled()
  })

  it('does not create orders when payment URL construction fails', async () => {
    buildZpayPaymentUrlMock.mockImplementationOnce(() => {
      throw new Error('bad payment config')
    })

    const { POST } = await import('@/app/api/billing/orders/route')

    await expect(POST(request({ productType: 'credit_pack', productId: 'pack_1', paymentType: 'alipay' }))).rejects.toThrow('bad payment config')
    expect(createOrderMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the requested product is unavailable', async () => {
    findCreditPackByIdMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(request({ productType: 'credit_pack', productId: 'pack_missing' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '商品不可用。' })
    expect(findCreditPackByIdMock).toHaveBeenCalledWith('pack_missing')
    expect(createOrderMock).not.toHaveBeenCalled()
    expect(buildZpayPaymentUrlMock).not.toHaveBeenCalled()
  })
})
