import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOrderByIdMock = vi.fn()
const findCreditPackByIdMock = vi.fn()
const findMembershipPlanByIdMock = vi.fn()
const fulfillCreditPackOrderMock = vi.fn(async () => true)
const fulfillMembershipOrderMock = vi.fn(async () => true)

vi.mock('@/lib/commercial/billing-store', () => ({
  findOrderById: findOrderByIdMock,
  findCreditPackById: findCreditPackByIdMock,
  findMembershipPlanById: findMembershipPlanByIdMock,
  fulfillCreditPackOrder: fulfillCreditPackOrderMock,
  fulfillMembershipOrder: fulfillMembershipOrderMock
}))

describe('order fulfillment', () => {
  beforeEach(() => {
    findOrderByIdMock.mockReset()
    findCreditPackByIdMock.mockReset()
    findMembershipPlanByIdMock.mockReset()
    fulfillCreditPackOrderMock.mockClear()
    fulfillMembershipOrderMock.mockClear()
  })

  it('returns not_found when the order does not exist', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce(null)

    await expect(fulfillPaidOrder('order_missing', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'not_found' })
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(findMembershipPlanByIdMock).not.toHaveBeenCalled()
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('returns not_paid when the order is not paid', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', status: 'pending', fulfilledAt: null })

    await expect(fulfillPaidOrder('order_1', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'not_paid' })
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(findMembershipPlanByIdMock).not.toHaveBeenCalled()
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('does nothing for already fulfilled orders', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', status: 'paid', fulfilledAt: '2026-05-24T00:00:00.000Z' })

    await expect(fulfillPaidOrder('order_1', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'already_fulfilled' })
    expect(findCreditPackByIdMock).not.toHaveBeenCalled()
    expect(findMembershipPlanByIdMock).not.toHaveBeenCalled()
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('fulfills credit pack orders with base and bonus credits', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', userId: 'user_1', orderType: 'credit_pack', status: 'paid', productId: 'pack_1', fulfilledAt: null })
    findCreditPackByIdMock.mockResolvedValueOnce({ id: 'pack_1', credits: 100, bonusCredits: 20 })

    await expect(fulfillPaidOrder('order_1', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: true, reason: 'credit_pack' })
    expect(findCreditPackByIdMock).toHaveBeenCalledWith('pack_1')
    expect(fulfillCreditPackOrderMock).toHaveBeenCalledWith({ orderId: 'order_1', userId: 'user_1', credits: 120, now: '2026-05-24T00:01:00.000Z' })
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('fulfills membership orders for the plan validity window', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_2', userId: 'user_1', orderType: 'membership', status: 'paid', productId: 'plan_1', fulfilledAt: null })
    findMembershipPlanByIdMock.mockResolvedValueOnce({ id: 'plan_1', validityDays: 30, grantCredits: 200 })

    await expect(fulfillPaidOrder('order_2', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: true, reason: 'membership' })
    expect(findMembershipPlanByIdMock).toHaveBeenCalledWith('plan_1')
    expect(fulfillMembershipOrderMock).toHaveBeenCalledWith({
      orderId: 'order_2',
      userId: 'user_1',
      planId: 'plan_1',
      validityDays: 30,
      grantCredits: 200,
      startsAt: '2026-05-24T00:01:00.000Z',
      endsAt: '2026-06-23T00:01:00.000Z'
    })
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
  })

  it('returns already_fulfilled when a credit pack order is claimed concurrently', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_3', userId: 'user_1', orderType: 'credit_pack', status: 'paid', productId: 'pack_1', fulfilledAt: null })
    findCreditPackByIdMock.mockResolvedValueOnce({ id: 'pack_1', credits: 100, bonusCredits: 20 })
    fulfillCreditPackOrderMock.mockResolvedValueOnce(false)

    await expect(fulfillPaidOrder('order_3', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'already_fulfilled' })
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('returns not_found when the credit pack product does not exist', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_4', userId: 'user_1', orderType: 'credit_pack', status: 'paid', productId: 'pack_missing', fulfilledAt: null })
    findCreditPackByIdMock.mockResolvedValueOnce(null)

    await expect(fulfillPaidOrder('order_4', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'not_found' })
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })

  it('returns not_found when the membership product does not exist', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_4', userId: 'user_1', orderType: 'membership', status: 'paid', productId: 'plan_missing', fulfilledAt: null })
    findMembershipPlanByIdMock.mockResolvedValueOnce(null)

    await expect(fulfillPaidOrder('order_4', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'not_found' })
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
    expect(fulfillMembershipOrderMock).not.toHaveBeenCalled()
  })
})
