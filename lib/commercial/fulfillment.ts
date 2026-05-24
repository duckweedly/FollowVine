import { findCreditPackById, findMembershipPlanById, findOrderById, fulfillCreditPackOrder, fulfillMembershipOrder } from './billing-store'

type FulfillmentResult = {
  fulfilled: boolean
  reason: 'not_found' | 'not_paid' | 'already_fulfilled' | 'credit_pack' | 'membership'
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function fulfillPaidOrder(orderId: string, now: string): Promise<FulfillmentResult> {
  const order = await findOrderById(orderId)
  if (!order) return { fulfilled: false, reason: 'not_found' }
  if (order.status !== 'paid') return { fulfilled: false, reason: 'not_paid' }
  if (order.fulfilledAt) return { fulfilled: false, reason: 'already_fulfilled' }

  if (order.orderType === 'credit_pack') {
    const pack = await findCreditPackById(order.productId)
    if (!pack) return { fulfilled: false, reason: 'not_found' }
    const fulfilled = await fulfillCreditPackOrder({ orderId: order.id, userId: order.userId, credits: pack.credits + pack.bonusCredits, now })
    return fulfilled ? { fulfilled: true, reason: 'credit_pack' } : { fulfilled: false, reason: 'already_fulfilled' }
  }

  const plan = await findMembershipPlanById(order.productId)
  if (!plan) return { fulfilled: false, reason: 'not_found' }
  const fulfilled = await fulfillMembershipOrder({
    orderId: order.id,
    userId: order.userId,
    planId: plan.id,
    validityDays: plan.validityDays,
    grantCredits: plan.grantCredits,
    startsAt: now,
    endsAt: addDays(now, plan.validityDays)
  })
  return fulfilled ? { fulfilled: true, reason: 'membership' } : { fulfilled: false, reason: 'already_fulfilled' }
}
