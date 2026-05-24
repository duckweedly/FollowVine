import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
const withTransactionMock = vi.fn(async (callback: (tx: { query: typeof queryMock }) => Promise<unknown>) => callback({ query: queryMock }))

vi.mock('@/lib/db', () => ({ query: queryMock, withTransaction: withTransactionMock }))

describe('billing store', () => {
  beforeEach(() => {
    queryMock.mockReset()
    withTransactionMock.mockClear()
  })

  it('creates pending orders', async () => {
    const { createOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await createOrder({ id: 'order_1', userId: 'user_1', orderType: 'credit_pack', amountCents: 990, productId: 'pack_1', provider: 'zpay', now: '2026-05-24T00:00:00.000Z' })

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into orders'), ['order_1', 'user_1', 'credit_pack', 'pending', 990, 'zpay', 'pack_1', '2026-05-24T00:00:00.000Z'])
  })

  it('fulfills a credit pack order in one transaction', async () => {
    const { fulfillCreditPackOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'user_1' }] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'order_1' }] })
    queryMock.mockResolvedValue({ rows: [] })

    await expect(fulfillCreditPackOrder({ orderId: 'order_1', userId: 'user_1', credits: 100, now: '2026-05-24T00:00:00.000Z' })).resolves.toBe(true)

    expect(withTransactionMock).toHaveBeenCalledOnce()
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update orders'), ['order_1', '2026-05-24T00:00:00.000Z'])
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update credit_accounts'), [100, 'user_1', '2026-05-24T00:00:00.000Z'])
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.arrayContaining(['credit_pack_purchase', 100, 'order', 'order_1']))
  })

  it('does not claim credit pack orders when the credit account is missing', async () => {
    const { fulfillCreditPackOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(fulfillCreditPackOrder({ orderId: 'order_1', userId: 'user_missing', credits: 100, now: '2026-05-24T00:00:00.000Z' })).resolves.toBe(false)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('from credit_accounts'), ['user_missing'])
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('update orders'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.any(Array))
  })

  it('does not grant credits when a credit pack order was already claimed', async () => {
    const { fulfillCreditPackOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'user_1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(fulfillCreditPackOrder({ orderId: 'order_1', userId: 'user_1', credits: 100, now: '2026-05-24T00:00:00.000Z' })).resolves.toBe(false)

    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('update credit_accounts'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.any(Array))
  })

  it('does not claim membership orders when grant credits require a missing credit account', async () => {
    const { fulfillMembershipOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(fulfillMembershipOrder({
      orderId: 'order_1',
      userId: 'user_missing',
      planId: 'plan_1',
      validityDays: 30,
      grantCredits: 100,
      startsAt: '2026-05-24T00:00:00.000Z',
      endsAt: '2026-06-23T00:00:00.000Z'
    })).resolves.toBe(false)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('from credit_accounts'), ['user_missing'])
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('update orders'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into user_memberships'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.any(Array))
  })

  it('does not create memberships when a membership order was already claimed', async () => {
    const { fulfillMembershipOrder } = await import('@/lib/commercial/billing-store')
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'user_1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(fulfillMembershipOrder({
      orderId: 'order_1',
      userId: 'user_1',
      planId: 'plan_1',
      validityDays: 30,
      grantCredits: 100,
      startsAt: '2026-05-24T00:00:00.000Z',
      endsAt: '2026-06-23T00:00:00.000Z'
    })).resolves.toBe(false)

    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into user_memberships'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('update credit_accounts'), expect.any(Array))
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.any(Array))
  })
})
