# FollowVine Payment and Credit Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 paid loop: membership plans, credit packs, Z-Pay / 易支付-style order creation, callback verification, idempotent fulfillment, credit ledger entries, and admin correction hooks.

**Architecture:** Keep payment and fulfillment as server-only commercial modules. PostgreSQL remains the source of truth for products, orders, payment events, memberships, credit accounts, and ledger entries; provider callbacks only mark and fulfill internal orders after signature verification. User-facing routes create orders and show account balances, while admin routes perform auditable manual corrections.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL via `pg`, Node `crypto`, Vitest, Playwright where a browser flow is needed.

---

## Scope Check

This plan covers Phase 2 only. It does not implement async image task execution, weighted model-channel routing, real SMS/email delivery, a full commercial homepage, SEO pages, template library, coupons, affiliate programs, or BI dashboards.

The payment integration assumes a Z-Pay / 易支付-compatible API shape: MD5 signing over sorted non-empty query parameters, provider fields such as `pid`, `type`, `out_trade_no`, `notify_url`, `return_url`, `name`, `money`, `trade_no`, `trade_status`, `sign`, and `sign_type`. If the actual Z-Pay provider differs, only `lib/commercial/zpay.ts` and its tests should change.

## File Structure

Create or modify these files:

- Modify `db/schema.sql`: add `credit_packs`, `payment_events`, and order fulfillment columns/indexes.
- Modify `lib/commercial/types.ts`: add `CreditPack`, `Order`, `PaymentEvent`, and billing input/output types.
- Create `lib/commercial/billing-store.ts`: store helpers for plans, packs, orders, payment events, memberships, credit accounts, and ledger writes.
- Create `lib/commercial/zpay.ts`: provider signing, verification, and payment URL construction.
- Create `lib/commercial/fulfillment.ts`: idempotent paid-order fulfillment for membership and credit-pack orders.
- Create `lib/auth/current-user.ts`: shared server-side session-to-user helper for user routes.
- Create `app/api/billing/orders/route.ts`: authenticated order creation route.
- Create `app/api/payments/zpay/notify/route.ts`: Z-Pay callback route.
- Create `app/api/admin/credits/adjust/route.ts`: admin manual credit adjustment route.
- Create `app/api/admin/orders/fulfill/route.ts`: admin manual paid-order correction route.
- Modify `app/account/page.tsx`: render account balance, membership, orders, and ledger shell from store helpers.
- Create `tests/unit/billing-schema.test.ts`.
- Create `tests/unit/zpay.test.ts`.
- Create `tests/unit/fulfillment.test.ts`.
- Create `tests/unit/billing-store.test.ts`.
- Create `tests/unit/current-user.test.ts`.
- Create `tests/integration/billing-order-route.test.ts`.
- Create `tests/integration/zpay-notify-route.test.ts`.
- Create `tests/integration/admin-credit-route.test.ts`.
- Create `tests/integration/admin-order-fulfill-route.test.ts`.
- Create `tests/e2e/account-billing-shell.spec.ts`.

## Task 1: Billing Schema and Types

**Files:**
- Modify: `db/schema.sql`
- Modify: `lib/commercial/types.ts`
- Test: `tests/unit/billing-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/billing-schema.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('billing schema', () => {
  it('defines credit packs, payment events, and fulfillment fields', async () => {
    const schema = await readFile(join(process.cwd(), 'db/schema.sql'), 'utf8')

    expect(schema).toContain('create table if not exists credit_packs')
    expect(schema).toContain('create table if not exists payment_events')
    expect(schema).toContain('alter table orders add column if not exists fulfilled_at timestamptz')
    expect(schema).toContain('payment_events_order_id_idx')
    expect(schema).toContain('credit_packs_active_idx')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/billing-schema.test.ts`

Expected: FAIL because the billing schema additions do not exist.

- [ ] **Step 3: Add schema additions**

Append this SQL to `db/schema.sql` after the existing commercial schema:

```sql
create table if not exists credit_packs (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  credits integer not null check (credits > 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists credit_packs_active_idx on credit_packs(is_active);

alter table orders add column if not exists fulfilled_at timestamptz;

create table if not exists payment_events (
  id text primary key,
  order_id text references orders(id),
  provider text not null,
  provider_trade_no text,
  event_type text not null check (event_type in ('notify', 'manual_correction')),
  payload jsonb not null,
  is_valid boolean not null,
  created_at timestamptz not null
);

create index if not exists payment_events_order_id_idx on payment_events(order_id);
create index if not exists payment_events_provider_trade_no_idx on payment_events(provider_trade_no);
```

- [ ] **Step 4: Add billing types**

Append these exports to `lib/commercial/types.ts`:

```ts
export type CreditPack = {
  id: string
  name: string
  priceCents: number
  credits: number
  bonusCredits: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Order = {
  id: string
  userId: string
  orderType: OrderType
  status: OrderStatus
  amountCents: number
  provider: string
  providerTradeNo: string | null
  productId: string
  paidAt: string | null
  fulfilledAt: string | null
  createdAt: string
  updatedAt: string
}

export type PaymentEvent = {
  id: string
  orderId: string | null
  provider: string
  providerTradeNo: string | null
  eventType: 'notify' | 'manual_correction'
  payload: Record<string, unknown>
  isValid: boolean
  createdAt: string
}

export type CreateOrderInput = {
  id: string
  userId: string
  orderType: OrderType
  amountCents: number
  productId: string
  provider: string
  now: string
}
```

- [ ] **Step 5: Run schema test and typecheck**

Run: `npm run test:unit -- tests/unit/billing-schema.test.ts && npm run typecheck`

Expected: PASS.

## Task 2: Z-Pay Signing and Payment URL Helper

**Files:**
- Create: `lib/commercial/zpay.ts`
- Test: `tests/unit/zpay.test.ts`

- [ ] **Step 1: Write the failing Z-Pay tests**

Create `tests/unit/zpay.test.ts`:

```ts
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildZpayPaymentUrl, signZpayParams, verifyZpaySignature } from '@/lib/commercial/zpay'

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

describe('zpay helpers', () => {
  it('signs non-empty params by sorted key order and excludes sign fields', () => {
    const params = {
      money: '9.90',
      name: 'Starter Credits',
      out_trade_no: 'order_1',
      pid: '1001',
      sign: 'ignored',
      sign_type: 'MD5',
      empty: ''
    }

    expect(signZpayParams(params, 'secret')).toBe(md5('money=9.90&name=Starter Credits&out_trade_no=order_1&pid=1001secret'))
  })

  it('verifies valid signatures and rejects wrong signatures', () => {
    const params = { pid: '1001', out_trade_no: 'order_1', money: '9.90' }
    const sign = signZpayParams(params, 'secret')

    expect(verifyZpaySignature({ ...params, sign, sign_type: 'MD5' }, 'secret')).toBe(true)
    expect(verifyZpaySignature({ ...params, sign: 'bad', sign_type: 'MD5' }, 'secret')).toBe(false)
  })

  it('builds payment URLs with signed query parameters', () => {
    const url = buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990
    })

    expect(url.startsWith('https://pay.example.com/submit.php?')).toBe(true)
    expect(url).toContain('out_trade_no=order_1')
    expect(url).toContain('money=9.90')
    expect(url).toContain('sign_type=MD5')
    expect(url).toContain('sign=')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/zpay.test.ts`

Expected: FAIL because `lib/commercial/zpay.ts` does not exist.

- [ ] **Step 3: Create Z-Pay helper**

Create `lib/commercial/zpay.ts`:

```ts
import { createHash, timingSafeEqual } from 'node:crypto'

type ZpayParams = Record<string, string | number | null | undefined>

function normalizeValue(value: string | number): string {
  return String(value)
}

function canonicalize(params: ZpayParams): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '' && value !== null && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeValue(value as string | number)}`)
    .join('&')
}

export function signZpayParams(params: ZpayParams, key: string): string {
  return createHash('md5').update(`${canonicalize(params)}${key}`).digest('hex')
}

export function verifyZpaySignature(params: ZpayParams & { sign?: string }, key: string): boolean {
  if (!params.sign) return false
  const expected = signZpayParams(params, key)
  const actual = Buffer.from(params.sign)
  const expectedBuffer = Buffer.from(expected)
  if (actual.length !== expectedBuffer.length) return false
  return timingSafeEqual(actual, expectedBuffer)
}

export function buildZpayPaymentUrl(input: {
  gatewayUrl: string
  pid: string
  key: string
  paymentType: string
  outTradeNo: string
  notifyUrl: string
  returnUrl: string
  name: string
  amountCents: number
}): string {
  const params: Record<string, string> = {
    pid: input.pid,
    type: input.paymentType,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name,
    money: (input.amountCents / 100).toFixed(2)
  }
  const sign = signZpayParams(params, input.key)
  const query = new URLSearchParams({ ...params, sign, sign_type: 'MD5' })
  return `${input.gatewayUrl}?${query.toString()}`
}
```

- [ ] **Step 4: Run Z-Pay tests**

Run: `npm run test:unit -- tests/unit/zpay.test.ts`

Expected: PASS.

## Task 3: Billing Store Helpers

**Files:**
- Create: `lib/commercial/billing-store.ts`
- Test: `tests/unit/billing-store.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `tests/unit/billing-store.test.ts`:

```ts
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
    queryMock.mockResolvedValue({ rows: [] })

    await fulfillCreditPackOrder({ orderId: 'order_1', userId: 'user_1', credits: 100, now: '2026-05-24T00:00:00.000Z' })

    expect(withTransactionMock).toHaveBeenCalledOnce()
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update credit_accounts'), [100, 'user_1', '2026-05-24T00:00:00.000Z'])
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into credit_ledger_entries'), expect.arrayContaining(['credit_pack_purchase', 100, 'order', 'order_1']))
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update orders'), ['order_1', '2026-05-24T00:00:00.000Z'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/billing-store.test.ts`

Expected: FAIL because `billing-store.ts` does not exist.

- [ ] **Step 3: Create billing store helper**

Create `lib/commercial/billing-store.ts`:

```ts
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

export async function fulfillCreditPackOrder(input: { orderId: string; userId: string; credits: number; now: string }): Promise<void> {
  await withTransaction(async (tx) => {
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
    await tx.query(
      `update orders
       set fulfilled_at = $2, updated_at = $2
       where id = $1 and fulfilled_at is null`,
      [input.orderId, input.now]
    )
  })
}

export async function fulfillMembershipOrder(input: { orderId: string; userId: string; planId: string; validityDays: number; grantCredits: number; startsAt: string; endsAt: string }): Promise<void> {
  await withTransaction(async (tx) => {
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
    await tx.query(
      `update orders
       set fulfilled_at = $2, updated_at = $2
       where id = $1 and fulfilled_at is null`,
      [input.orderId, input.startsAt]
    )
  })
}
```

- [ ] **Step 4: Run billing store tests**

Run: `npm run test:unit -- tests/unit/billing-store.test.ts`

Expected: PASS.

## Task 4: Fulfillment Rules

**Files:**
- Create: `lib/commercial/fulfillment.ts`
- Test: `tests/unit/fulfillment.test.ts`

- [ ] **Step 1: Write failing fulfillment tests**

Create `tests/unit/fulfillment.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOrderByIdMock = vi.fn()
const findCreditPackByIdMock = vi.fn()
const findMembershipPlanByIdMock = vi.fn()
const fulfillCreditPackOrderMock = vi.fn(async () => undefined)
const fulfillMembershipOrderMock = vi.fn(async () => undefined)

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

  it('does nothing for already fulfilled orders', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', status: 'paid', fulfilledAt: '2026-05-24T00:00:00.000Z' })

    await expect(fulfillPaidOrder('order_1', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: false, reason: 'already_fulfilled' })
    expect(fulfillCreditPackOrderMock).not.toHaveBeenCalled()
  })

  it('fulfills credit pack orders', async () => {
    const { fulfillPaidOrder } = await import('@/lib/commercial/fulfillment')
    findOrderByIdMock.mockResolvedValueOnce({ id: 'order_1', userId: 'user_1', orderType: 'credit_pack', status: 'paid', productId: 'pack_1', fulfilledAt: null })
    findCreditPackByIdMock.mockResolvedValueOnce({ id: 'pack_1', credits: 100, bonusCredits: 20 })

    await expect(fulfillPaidOrder('order_1', '2026-05-24T00:01:00.000Z')).resolves.toEqual({ fulfilled: true, reason: 'credit_pack' })
    expect(fulfillCreditPackOrderMock).toHaveBeenCalledWith({ orderId: 'order_1', userId: 'user_1', credits: 120, now: '2026-05-24T00:01:00.000Z' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/fulfillment.test.ts`

Expected: FAIL because `fulfillment.ts` does not exist.

- [ ] **Step 3: Create fulfillment helper**

Create `lib/commercial/fulfillment.ts`:

```ts
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
    await fulfillCreditPackOrder({ orderId: order.id, userId: order.userId, credits: pack.credits + pack.bonusCredits, now })
    return { fulfilled: true, reason: 'credit_pack' }
  }

  const plan = await findMembershipPlanById(order.productId)
  if (!plan) return { fulfilled: false, reason: 'not_found' }
  await fulfillMembershipOrder({
    orderId: order.id,
    userId: order.userId,
    planId: plan.id,
    validityDays: plan.validityDays,
    grantCredits: plan.grantCredits,
    startsAt: now,
    endsAt: addDays(now, plan.validityDays)
  })
  return { fulfilled: true, reason: 'membership' }
}
```

- [ ] **Step 4: Run fulfillment tests**

Run: `npm run test:unit -- tests/unit/fulfillment.test.ts`

Expected: PASS.

## Task 5: Authenticated Order Creation Route

**Files:**
- Create: `lib/auth/current-user.ts`
- Create: `app/api/billing/orders/route.ts`
- Test: `tests/unit/current-user.test.ts`
- Test: `tests/integration/billing-order-route.test.ts`

- [ ] **Step 1: Write failing current-user tests**

Create `tests/unit/current-user.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const findUserByIdMock = vi.fn()

vi.mock('@/lib/commercial/store', () => ({ findUserById: findUserByIdMock }))

describe('current user helper', () => {
  it('returns null for missing session cookies', async () => {
    const { getCurrentUserFromSession } = await import('@/lib/auth/current-user')
    await expect(getCurrentUserFromSession(null)).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Write failing order route tests**

Create `tests/integration/billing-order-route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: vi.fn(async () => ({ id: 'user_1', role: 'user', status: 'active' })) }))
vi.mock('@/lib/commercial/billing-store', () => ({
  createOrder: vi.fn(async () => undefined),
  findCreditPackById: vi.fn(async () => ({ id: 'pack_1', name: 'Starter Credits', priceCents: 990 })),
  findMembershipPlanById: vi.fn(async () => null)
}))
vi.mock('@/lib/commercial/zpay', () => ({ buildZpayPaymentUrl: vi.fn(() => 'https://pay.example.com/submit.php?signed=1') }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })) }))

describe('billing order route', () => {
  it('creates credit-pack payment orders', async () => {
    process.env.ZPAY_GATEWAY_URL = 'https://pay.example.com/submit.php'
    process.env.ZPAY_PID = '1001'
    process.env.ZPAY_KEY = 'secret'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

    const { POST } = await import('@/app/api/billing/orders/route')
    const response = await POST(new Request('http://test.local/api/billing/orders', {
      method: 'POST',
      body: JSON.stringify({ productType: 'credit_pack', productId: 'pack_1', paymentType: 'alipay' })
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.paymentUrl).toBe('https://pay.example.com/submit.php?signed=1')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/current-user.test.ts && npm run test:integration -- tests/integration/billing-order-route.test.ts`

Expected: FAIL because files do not exist.

- [ ] **Step 4: Create current-user helper**

Create `lib/auth/current-user.ts`:

```ts
import { verifySessionToken } from './session'
import { findUserById } from '@/lib/commercial/store'
import type { User } from '@/lib/commercial/types'

export async function getCurrentUserFromSession(sessionToken: string | null | undefined): Promise<User | null> {
  if (!sessionToken) return null
  const payload = verifySessionToken(sessionToken)
  if (!payload) return null
  const user = await findUserById(payload.userId)
  return user?.status === 'active' ? user : null
}
```

- [ ] **Step 5: Create order route**

Create `app/api/billing/orders/route.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { createOrder, findCreditPackById, findMembershipPlanById } from '@/lib/commercial/billing-store'
import { buildZpayPaymentUrl } from '@/lib/commercial/zpay'

type OrderRequest = {
  productType?: unknown
  productId?: unknown
  paymentType?: unknown
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!user) return NextResponse.json({ error: '请先登录。' }, { status: 401 })

  const body = await request.json().catch(() => null) as OrderRequest | null
  const productType = String(body?.productType ?? '')
  const productId = String(body?.productId ?? '')
  const paymentType = String(body?.paymentType ?? 'alipay')

  const product = productType === 'credit_pack'
    ? await findCreditPackById(productId)
    : productType === 'membership'
      ? await findMembershipPlanById(productId)
      : null

  if (!product) return NextResponse.json({ error: '商品不可用。' }, { status: 400 })

  const orderId = `order_${randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()
  await createOrder({
    id: orderId,
    userId: user.id,
    orderType: productType === 'membership' ? 'membership' : 'credit_pack',
    amountCents: product.priceCents,
    productId: product.id,
    provider: 'zpay',
    now
  })

  const appUrl = requiredEnv('NEXT_PUBLIC_APP_URL')
  const paymentUrl = buildZpayPaymentUrl({
    gatewayUrl: requiredEnv('ZPAY_GATEWAY_URL'),
    pid: requiredEnv('ZPAY_PID'),
    key: requiredEnv('ZPAY_KEY'),
    paymentType,
    outTradeNo: orderId,
    notifyUrl: `${appUrl}/api/payments/zpay/notify`,
    returnUrl: `${appUrl}/account`,
    name: product.name,
    amountCents: product.priceCents
  })

  return NextResponse.json({ orderId, paymentUrl })
}
```

- [ ] **Step 6: Run order route tests**

Run: `npm run test:unit -- tests/unit/current-user.test.ts && npm run test:integration -- tests/integration/billing-order-route.test.ts`

Expected: PASS.

## Task 6: Z-Pay Notify Route and Fulfillment

**Files:**
- Create: `app/api/payments/zpay/notify/route.ts`
- Test: `tests/integration/zpay-notify-route.test.ts`

- [ ] **Step 1: Write failing notify route tests**

Create `tests/integration/zpay-notify-route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const recordPaymentEventMock = vi.fn(async () => undefined)
const markOrderPaidMock = vi.fn(async () => undefined)
const fulfillPaidOrderMock = vi.fn(async () => ({ fulfilled: true, reason: 'credit_pack' }))

vi.mock('@/lib/commercial/billing-store', () => ({ recordPaymentEvent: recordPaymentEventMock, markOrderPaid: markOrderPaidMock }))
vi.mock('@/lib/commercial/fulfillment', () => ({ fulfillPaidOrder: fulfillPaidOrderMock }))
vi.mock('@/lib/commercial/zpay', () => ({ verifyZpaySignature: vi.fn(() => true) }))

describe('zpay notify route', () => {
  it('marks paid orders and fulfills them after valid notifications', async () => {
    process.env.ZPAY_KEY = 'secret'
    const { POST } = await import('@/app/api/payments/zpay/notify/route')
    const response = await POST(new Request('http://test.local/api/payments/zpay/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ out_trade_no: 'order_1', trade_no: 'provider_1', trade_status: 'TRADE_SUCCESS', sign: 'valid', sign_type: 'MD5' })
    }))

    await expect(response.text()).resolves.toBe('success')
    expect(markOrderPaidMock).toHaveBeenCalledWith({ orderId: 'order_1', providerTradeNo: 'provider_1', paidAt: expect.any(String) })
    expect(fulfillPaidOrderMock).toHaveBeenCalledWith('order_1', expect.any(String))
    expect(recordPaymentEventMock).toHaveBeenCalledWith(expect.objectContaining({ provider: 'zpay', providerTradeNo: 'provider_1', isValid: true }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- tests/integration/zpay-notify-route.test.ts`

Expected: FAIL because notify route does not exist.

- [ ] **Step 3: Create notify route**

Create `app/api/payments/zpay/notify/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { fulfillPaidOrder } from '@/lib/commercial/fulfillment'
import { markOrderPaid, recordPaymentEvent } from '@/lib/commercial/billing-store'
import { verifyZpaySignature } from '@/lib/commercial/zpay'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData()
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  const now = new Date().toISOString()
  const isValid = verifyZpaySignature(params, requiredEnv('ZPAY_KEY'))
  const orderId = params.out_trade_no ?? null
  const providerTradeNo = params.trade_no ?? null

  await recordPaymentEvent({
    orderId,
    provider: 'zpay',
    providerTradeNo,
    eventType: 'notify',
    payload: params,
    isValid,
    createdAt: now
  })

  if (!isValid || params.trade_status !== 'TRADE_SUCCESS' || !orderId || !providerTradeNo) {
    return new NextResponse('fail', { status: 400 })
  }

  await markOrderPaid({ orderId, providerTradeNo, paidAt: now })
  await fulfillPaidOrder(orderId, now)
  return new NextResponse('success')
}
```

- [ ] **Step 4: Run notify tests**

Run: `npm run test:integration -- tests/integration/zpay-notify-route.test.ts`

Expected: PASS.

## Task 7: Admin Manual Corrections

**Files:**
- Create: `app/api/admin/credits/adjust/route.ts`
- Create: `app/api/admin/orders/fulfill/route.ts`
- Test: `tests/integration/admin-credit-route.test.ts`
- Test: `tests/integration/admin-order-fulfill-route.test.ts`

- [ ] **Step 1: Write failing admin correction tests**

Create `tests/integration/admin-credit-route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: vi.fn(async () => ({ id: 'admin_1', role: 'admin', status: 'active' })) }))
vi.mock('@/lib/auth/permissions', () => ({ canAccessAdmin: vi.fn(() => true) }))
vi.mock('@/lib/commercial/credits', () => ({ applyAdminCreditAdjustment: vi.fn(() => ({ balanceAfter: 15, ledger: { type: 'admin_adjustment', amount: 5, balanceAfter: 15, referenceType: 'admin_adjustment', referenceId: null, reason: 'support correction' } })) }))
vi.mock('@/lib/db', () => ({ withTransaction: vi.fn(async (callback) => callback({ query: vi.fn(async () => ({ rows: [{ balance: 10 }] })) })) }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })) }))

describe('admin credit adjustment route', () => {
  it('accepts admin credit adjustments with reasons', async () => {
    const { POST } = await import('@/app/api/admin/credits/adjust/route')
    const response = await POST(new Request('http://test.local/api/admin/credits/adjust', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user_1', amount: 5, reason: 'support correction' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
```

Create `tests/integration/admin-order-fulfill-route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUserFromSession: vi.fn(async () => ({ id: 'admin_1', role: 'admin', status: 'active' })) }))
vi.mock('@/lib/auth/permissions', () => ({ canAccessAdmin: vi.fn(() => true) }))
vi.mock('@/lib/commercial/billing-store', () => ({ markOrderPaid: vi.fn(async () => undefined), recordPaymentEvent: vi.fn(async () => undefined) }))
vi.mock('@/lib/commercial/fulfillment', () => ({ fulfillPaidOrder: vi.fn(async () => ({ fulfilled: true, reason: 'credit_pack' })) }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })) }))

describe('admin order fulfillment route', () => {
  it('marks and fulfills orders manually', async () => {
    const { POST } = await import('@/app/api/admin/orders/fulfill/route')
    const response = await POST(new Request('http://test.local/api/admin/orders/fulfill', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'order_1', providerTradeNo: 'manual_1', reason: 'manual correction' })
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, fulfilled: true, reason: 'credit_pack' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:integration -- tests/integration/admin-credit-route.test.ts tests/integration/admin-order-fulfill-route.test.ts`

Expected: FAIL because admin correction routes do not exist.

- [ ] **Step 3: Create admin correction routes**

Create `app/api/admin/credits/adjust/route.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { canAccessAdmin } from '@/lib/auth/permissions'
import { applyAdminCreditAdjustment } from '@/lib/commercial/credits'
import { withTransaction } from '@/lib/db'

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const admin = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!canAccessAdmin(admin)) return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 })

  const body = await request.json().catch(() => null) as { userId?: unknown; amount?: unknown; reason?: unknown } | null
  const userId = String(body?.userId ?? '')
  const amount = Number(body?.amount)
  const reason = String(body?.reason ?? '')
  const now = new Date().toISOString()

  await withTransaction(async (tx) => {
    const account = await tx.query<{ balance: number }>('select balance from credit_accounts where user_id = $1 for update', [userId])
    if (!account.rows[0]) throw new Error('Credit account not found')
    const transition = applyAdminCreditAdjustment({ balance: account.rows[0].balance, amount, reason })
    await tx.query('update credit_accounts set balance = $1, updated_at = $2 where user_id = $3', [transition.balanceAfter, now, userId])
    await tx.query(
      `insert into credit_ledger_entries (id, user_id, type, amount, balance_after, reference_type, reference_id, reason, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [`cle_${randomUUID().replace(/-/g, '')}`, userId, transition.ledger.type, transition.ledger.amount, transition.ledger.balanceAfter, transition.ledger.referenceType, transition.ledger.referenceId, transition.ledger.reason, now]
    )
  })

  return NextResponse.json({ ok: true })
}
```

Create `app/api/admin/orders/fulfill/route.ts`:

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { canAccessAdmin } from '@/lib/auth/permissions'
import { markOrderPaid, recordPaymentEvent } from '@/lib/commercial/billing-store'
import { fulfillPaidOrder } from '@/lib/commercial/fulfillment'

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const admin = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!canAccessAdmin(admin)) return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 })

  const body = await request.json().catch(() => null) as { orderId?: unknown; providerTradeNo?: unknown; reason?: unknown } | null
  const orderId = String(body?.orderId ?? '')
  const providerTradeNo = String(body?.providerTradeNo ?? '')
  const reason = String(body?.reason ?? '')
  const now = new Date().toISOString()

  await recordPaymentEvent({
    orderId,
    provider: 'zpay',
    providerTradeNo,
    eventType: 'manual_correction',
    payload: { reason, adminId: admin.id },
    isValid: true,
    createdAt: now
  })
  await markOrderPaid({ orderId, providerTradeNo, paidAt: now })
  const result = await fulfillPaidOrder(orderId, now)
  return NextResponse.json({ ok: true, ...result })
}
```

- [ ] **Step 4: Run admin correction tests**

Run: `npm run test:integration -- tests/integration/admin-credit-route.test.ts tests/integration/admin-order-fulfill-route.test.ts`

Expected: PASS.

## Task 8: Account Billing Shell

**Files:**
- Modify: `app/account/page.tsx`
- Create: `tests/e2e/account-billing-shell.spec.ts`

- [ ] **Step 1: Write failing account billing e2e test**

Create `tests/e2e/account-billing-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('account page shows billing entry points', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account & Balance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '会员状态' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '积分流水' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '订单记录' })).toBeVisible()
  await expect(page.getByRole('link', { name: '购买会员或积分' })).toHaveAttribute('href', '/pricing')
})
```

- [ ] **Step 2: Run e2e test to verify it fails**

Run: `FOLLOWVINE_REUSE_EXISTING_SERVER=1 npm run test:e2e -- tests/e2e/account-billing-shell.spec.ts`

Expected: FAIL because account page does not show order record or pricing link yet.

- [ ] **Step 3: Update account shell**

Modify `app/account/page.tsx` to:

```tsx
import Link from 'next/link'

export default function AccountPage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>Account & Balance</h1>
        <p>查看会员状态、积分余额、订单记录和积分流水。</p>
        <Link className="primary-button" href="/pricing">购买会员或积分</Link>
      </section>
      <section className="explainer-viewer">
        <h2>会员状态</h2>
        <p>当前未开通会员。</p>
      </section>
      <section className="explainer-viewer">
        <h2>积分流水</h2>
        <p>暂无积分流水。</p>
      </section>
      <section className="explainer-viewer">
        <h2>订单记录</h2>
        <p>暂无订单记录。</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Run account billing e2e test**

Run: `FOLLOWVINE_REUSE_EXISTING_SERVER=1 npm run test:e2e -- tests/e2e/account-billing-shell.spec.ts`

Expected: PASS if local server at 3100 is running. If not running, start `npm run dev -- --hostname 127.0.0.1 --port 3100` in background after confirming no existing server conflict.

## Task 9: Phase 2 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run billing unit tests**

Run:

```bash
npm run test:unit -- tests/unit/billing-schema.test.ts tests/unit/zpay.test.ts tests/unit/billing-store.test.ts tests/unit/fulfillment.test.ts tests/unit/current-user.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run billing integration tests**

Run:

```bash
npm run test:integration -- tests/integration/billing-order-route.test.ts tests/integration/zpay-notify-route.test.ts tests/integration/admin-credit-route.test.ts tests/integration/admin-order-fulfill-route.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and full Vitest**

Run:

```bash
npm run typecheck && npm run test
```

Expected: PASS.

- [ ] **Step 4: Run account billing e2e**

Run:

```bash
FOLLOWVINE_REUSE_EXISTING_SERVER=1 npm run test:e2e -- tests/e2e/account-billing-shell.spec.ts
```

Expected: PASS when the local 3100 dev server is running.

- [ ] **Step 5: Review changed files**

Run: `git status --short` and `git diff --stat`.

Expected: changes are limited to Phase 2 payment and credit loop files plus account shell updates.

## Coverage Map

- Credit packs and order/payment schema: Task 1
- Z-Pay signing/payment URL: Task 2
- Product/order/ledger store helpers: Task 3
- Idempotent paid-order fulfillment: Task 4
- Authenticated order creation: Task 5
- Z-Pay notify and fulfillment callback: Task 6
- Admin manual credit/order corrections: Task 7
- Account billing shell: Task 8
- Verification: Task 9

## Not Covered by This Plan

- Real SMS/email verification-code delivery provider
- Real Z-Pay provider sandbox calls or outbound payment creation beyond signed URL generation
- Async image generation task worker
- Model-channel weighted routing execution
- Commercial homepage, template library, SEO content pages
- Coupons, affiliate programs, revenue dashboards, or BI reports
