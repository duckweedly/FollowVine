import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '@/lib/db'
import type { CreateOrderInput, CreditPack, MembershipPlan, Order, OrderStatus, OrderType, PaymentEvent } from './types'

type OrderRow = {
  id: string
  user_id: string
  order_type: OrderType
  status: OrderStatus
  amount_cents: number
  provider: string
  provider_trade_no: string | null
  product_id: string
  paid_at: string | null
  fulfilled_at: string | null
  created_at: string
  updated_at: string
}

type CreditPackRow = {
  id: string
  name: string
  price_cents: number
  credits: number
  bonus_credits: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type MembershipPlanRow = {
  id: string
  name: string
  price_cents: number
  validity_days: number
  grant_credits: number
  discount_rate: number
  task_limit: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    orderType: row.order_type,
    status: row.status,
    amountCents: row.amount_cents,
    provider: row.provider,
    providerTradeNo: row.provider_trade_no,
    productId: row.product_id,
    paidAt: row.paid_at,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapCreditPack(row: CreditPackRow): CreditPack {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    credits: row.credits,
    bonusCredits: row.bonus_credits,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapMembershipPlan(row: MembershipPlanRow): MembershipPlan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    validityDays: row.validity_days,
    grantCredits: row.grant_credits,
    discountRate: Number(row.discount_rate),
    taskLimit: row.task_limit,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function findCreditPackById(id: string): Promise<CreditPack | null> {
  const result = await query<CreditPackRow>(
    `select id, name, price_cents, credits, bonus_credits, is_active, created_at, updated_at
     from credit_packs
     where id = $1 and is_active = true`,
    [id]
  )
  return result.rows[0] ? mapCreditPack(result.rows[0]) : null
}

export async function findMembershipPlanById(id: string): Promise<MembershipPlan | null> {
  const result = await query<MembershipPlanRow>(
    `select id, name, price_cents, validity_days, grant_credits, discount_rate, task_limit, is_active, created_at, updated_at
     from membership_plans
     where id = $1 and is_active = true`,
    [id]
  )
  return result.rows[0] ? mapMembershipPlan(result.rows[0]) : null
}

export async function findOrderById(id: string): Promise<Order | null> {
  const result = await query<OrderRow>(
    `select id, user_id, order_type, status, amount_cents, provider, provider_trade_no, product_id, paid_at, fulfilled_at, created_at, updated_at
     from orders
     where id = $1`,
    [id]
  )
  return result.rows[0] ? mapOrder(result.rows[0]) : null
}

export async function createOrder(input: CreateOrderInput): Promise<void> {
  await query(
    `insert into orders (id, user_id, order_type, status, amount_cents, provider, product_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
    [input.id, input.userId, input.orderType, 'pending', input.amountCents, input.provider, input.productId, input.now]
  )
}

export async function recordPaymentEvent(input: Omit<PaymentEvent, 'id'> & { id?: string }): Promise<void> {
  await query(
    `insert into payment_events (id, order_id, provider, provider_trade_no, event_type, payload, is_valid, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.id ?? `pe_${randomUUID().replace(/-/g, '')}`, input.orderId, input.provider, input.providerTradeNo, input.eventType, JSON.stringify(input.payload), input.isValid, input.createdAt]
  )
}

export async function markOrderPaid(input: { orderId: string; providerTradeNo: string; paidAt: string }): Promise<void> {
  await query(
    `update orders
     set status = 'paid', provider_trade_no = $2, paid_at = $3, updated_at = $3
     where id = $1 and status = 'pending'`,
    [input.orderId, input.providerTradeNo, input.paidAt]
  )
}

export async function fulfillCreditPackOrder(input: { orderId: string; userId: string; credits: number; now: string }): Promise<boolean> {
  return withTransaction(async (tx) => {
    const account = await tx.query<{ user_id: string }>(
      `select user_id
       from credit_accounts
       where user_id = $1
       for update`,
      [input.userId]
    )
    if (!account.rows[0]) return false

    const claim = await tx.query<{ id: string }>(
      `update orders
       set fulfilled_at = $2, updated_at = $2
       where id = $1 and status = 'paid' and fulfilled_at is null
       returning id`,
      [input.orderId, input.now]
    )
    if (!claim.rows[0]) return false

    await tx.query(
      `update credit_accounts
       set balance = balance + $1, updated_at = $3
       where user_id = $2`,
      [input.credits, input.userId, input.now]
    )
    await tx.query(
      `insert into credit_ledger_entries (id, user_id, type, amount, balance_after, reference_type, reference_id, reason, created_at)
       select $1, user_id, $2, $3, balance, $4, $5, null, $6
       from credit_accounts
       where user_id = $7`,
      [`cle_${randomUUID().replace(/-/g, '')}`, 'credit_pack_purchase', input.credits, 'order', input.orderId, input.now, input.userId]
    )
    return true
  })
}

export async function fulfillMembershipOrder(input: { orderId: string; userId: string; planId: string; validityDays: number; grantCredits: number; startsAt: string; endsAt: string }): Promise<boolean> {
  return withTransaction(async (tx) => {
    if (input.grantCredits > 0) {
      const account = await tx.query<{ user_id: string }>(
        `select user_id
         from credit_accounts
         where user_id = $1
         for update`,
        [input.userId]
      )
      if (!account.rows[0]) return false
    }

    const claim = await tx.query<{ id: string }>(
      `update orders
       set fulfilled_at = $2, updated_at = $2
       where id = $1 and status = 'paid' and fulfilled_at is null
       returning id`,
      [input.orderId, input.startsAt]
    )
    if (!claim.rows[0]) return false

    await tx.query(
      `insert into user_memberships (id, user_id, plan_id, status, starts_at, ends_at, created_at)
       values ($1, $2, $3, 'active', $4, $5, $4)`,
      [`um_${randomUUID().replace(/-/g, '')}`, input.userId, input.planId, input.startsAt, input.endsAt]
    )
    if (input.grantCredits > 0) {
      await tx.query(
        `update credit_accounts
         set balance = balance + $1, updated_at = $3
         where user_id = $2`,
        [input.grantCredits, input.userId, input.startsAt]
      )
      await tx.query(
        `insert into credit_ledger_entries (id, user_id, type, amount, balance_after, reference_type, reference_id, reason, created_at)
         select $1, user_id, $2, $3, balance, $4, $5, null, $6
         from credit_accounts
         where user_id = $7`,
        [`cle_${randomUUID().replace(/-/g, '')}`, 'membership_grant', input.grantCredits, 'order', input.orderId, input.startsAt, input.userId]
      )
    }
    return true
  })
}
