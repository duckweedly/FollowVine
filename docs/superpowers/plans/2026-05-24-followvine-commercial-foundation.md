# FollowVine Commercial Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 commercial MVP foundation: user identity, membership/credit/order/task/channel schema, pure business rules, auth primitives, admin shell, and logged-in user shell.

**Architecture:** Keep the existing Next.js app and add commercial modules beside the current demo instead of rewriting every page at once. PostgreSQL is the source of truth for users, memberships, credits, orders, tasks, model channels, and admin settings; early tasks are mostly schema, pure domain rules, stores, and route shells. The current image-generation prototype remains available while the commercial foundation is introduced through new `/workspace`, `/account`, `/login`, and `/admin` surfaces.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL via `pg`, Vitest, Playwright, Node `crypto` for signed sessions.

---

## Scope Check

The full commercial MVP design spans billing, payment, async generation, model routing, admin operations, and a commercial front end. This plan intentionally covers Phase 1 only: the commercial foundation. Payment fulfillment, Z-Pay / 易支付 callbacks, real task execution, model-channel failover, pricing pages, template library, and SEO pages get their own follow-up plans.

## File Structure

Create or modify these files:

- Modify `db/schema.sql`: add commercial tables and indexes while keeping `pages` and `share_links`.
- Create `lib/commercial/types.ts`: commercial domain types and status unions.
- Create `lib/commercial/pricing.ts`: fixed generation pricing with membership discount support.
- Create `lib/commercial/credits.ts`: pure credit reservation, confirmation, refund, and admin-adjustment transitions.
- Create `lib/commercial/task-state.ts`: valid generation-task state transitions.
- Create `lib/commercial/store.ts`: database access helpers for user lookup and first-login credit-account creation.
- Create `lib/auth/identity.ts`: phone/email identifier normalization.
- Create `lib/auth/session.ts`: signed session token creation and verification.
- Create `lib/auth/verification.ts`: verification-code generation, hashing, and expiry helpers.
- Create `lib/auth/permissions.ts`: admin access checks.
- Create `app/login/page.tsx`: passwordless login screen shell.
- Create `app/api/auth/request-code/route.ts`: creates a verification-code request.
- Create `app/api/auth/verify-code/route.ts`: verifies a code and sets a session cookie.
- Create `app/workspace/page.tsx`: logged-in workspace shell.
- Create `app/account/page.tsx`: account and balance shell.
- Create `components/admin/AdminNav.tsx`: admin navigation.
- Create `app/admin/layout.tsx`: admin layout.
- Create `app/admin/page.tsx`: dashboard shell.
- Create `app/admin/users/page.tsx`: users shell.
- Create `app/admin/orders/page.tsx`: orders shell.
- Create `app/admin/membership/page.tsx`: plans and credit packs shell.
- Create `app/admin/model-channels/page.tsx`: model-channel shell.
- Create `app/admin/tasks/page.tsx`: task shell.
- Create `app/admin/settings/page.tsx`: settings shell.
- Create `tests/unit/commercial-schema.test.ts`.
- Create `tests/unit/commercial-pricing.test.ts`.
- Create `tests/unit/commercial-credits.test.ts`.
- Create `tests/unit/task-state.test.ts`.
- Create `tests/unit/auth-identity.test.ts`.
- Create `tests/unit/auth-session.test.ts`.
- Create `tests/unit/auth-verification.test.ts`.
- Create `tests/unit/auth-permissions.test.ts`.
- Create `tests/unit/commercial-store.test.ts`.
- Create `tests/integration/auth-routes.test.ts`.
- Create `tests/e2e/commercial-shell.spec.ts`.

## Task 1: Commercial Database Schema

**Files:**
- Modify: `db/schema.sql`
- Test: `tests/unit/commercial-schema.test.ts`

- [ ] **Step 1: Write the failing schema coverage test**

Create `tests/unit/commercial-schema.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const requiredTables = [
  'users',
  'verification_codes',
  'membership_plans',
  'user_memberships',
  'credit_accounts',
  'credit_ledger_entries',
  'orders',
  'model_channels',
  'generation_tasks',
  'channel_attempts',
  'system_settings'
]

describe('commercial schema', () => {
  it('defines the commercial foundation tables and critical indexes', async () => {
    const schema = await readFile(join(process.cwd(), 'db/schema.sql'), 'utf8')

    for (const table of requiredTables) {
      expect(schema).toContain(`create table if not exists ${table}`)
    }

    expect(schema).toContain('users_login_identifier_idx')
    expect(schema).toContain('orders_user_id_idx')
    expect(schema).toContain('generation_tasks_status_idx')
    expect(schema).toContain('model_channels_enabled_idx')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/commercial-schema.test.ts`

Expected: FAIL because `users`, `orders`, `generation_tasks`, and the other commercial tables are not in `db/schema.sql` yet.

- [ ] **Step 3: Append the commercial schema**

Append this SQL to `db/schema.sql` after the existing `pages` and `share_links` definitions:

```sql
create table if not exists users (
  id text primary key,
  login_identifier text not null unique,
  login_type text not null check (login_type in ('phone', 'email')),
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists users_login_identifier_idx on users(login_identifier);
create index if not exists users_role_idx on users(role);

create table if not exists verification_codes (
  id text primary key,
  login_identifier text not null,
  login_type text not null check (login_type in ('phone', 'email')),
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
);

create index if not exists verification_codes_login_identifier_idx on verification_codes(login_identifier);
create index if not exists verification_codes_expires_at_idx on verification_codes(expires_at);

create table if not exists membership_plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  validity_days integer not null check (validity_days > 0),
  grant_credits integer not null default 0 check (grant_credits >= 0),
  discount_rate numeric(5, 4) not null default 1 check (discount_rate > 0 and discount_rate <= 1),
  task_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists user_memberships (
  id text primary key,
  user_id text not null references users(id),
  plan_id text not null references membership_plans(id),
  status text not null check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null
);

create index if not exists user_memberships_user_id_idx on user_memberships(user_id);

create table if not exists credit_accounts (
  user_id text primary key references users(id),
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null
);

create table if not exists credit_ledger_entries (
  id text primary key,
  user_id text not null references users(id),
  type text not null check (type in ('credit_pack_purchase', 'membership_grant', 'generation_reserve', 'generation_confirm', 'generation_refund', 'admin_adjustment')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  reference_type text,
  reference_id text,
  reason text,
  created_at timestamptz not null
);

create index if not exists credit_ledger_entries_user_id_idx on credit_ledger_entries(user_id);
create index if not exists credit_ledger_entries_reference_idx on credit_ledger_entries(reference_type, reference_id);

create table if not exists orders (
  id text primary key,
  user_id text not null references users(id),
  order_type text not null check (order_type in ('membership', 'credit_pack')),
  status text not null check (status in ('pending', 'paid', 'cancelled', 'failed')),
  amount_cents integer not null check (amount_cents >= 0),
  provider text not null default 'zpay',
  provider_trade_no text,
  product_id text not null,
  paid_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);

create table if not exists model_channels (
  id text primary key,
  name text not null,
  provider text not null,
  base_url text not null,
  api_key_encrypted text not null,
  model_name text not null,
  weight integer not null default 1 check (weight > 0),
  timeout_ms integer not null default 120000 check (timeout_ms > 0),
  is_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists model_channels_enabled_idx on model_channels(is_enabled);

create table if not exists generation_tasks (
  id text primary key,
  user_id text not null references users(id),
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed', 'refunded')),
  task_type text not null check (task_type in ('root_page', 'drill_down')),
  topic text,
  parent_page_id text references pages(id),
  style text not null,
  estimated_credits integer not null check (estimated_credits >= 0),
  charged_credits integer not null default 0 check (charged_credits >= 0),
  result_page_id text references pages(id),
  failure_reason text,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists generation_tasks_user_id_idx on generation_tasks(user_id);
create index if not exists generation_tasks_status_idx on generation_tasks(status);
create index if not exists generation_tasks_created_at_idx on generation_tasks(created_at);

create table if not exists channel_attempts (
  id text primary key,
  task_id text not null references generation_tasks(id),
  channel_id text not null references model_channels(id),
  status text not null check (status in ('running', 'succeeded', 'failed', 'timed_out')),
  error_summary text,
  latency_ms integer,
  is_final boolean not null default false,
  started_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists channel_attempts_task_id_idx on channel_attempts(task_id);
create index if not exists channel_attempts_channel_id_idx on channel_attempts(channel_id);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null
);
```

- [ ] **Step 4: Run the schema test**

Run: `npm run test:unit -- tests/unit/commercial-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 2: Commercial Domain Types and Pricing Rules

**Files:**
- Create: `lib/commercial/types.ts`
- Create: `lib/commercial/pricing.ts`
- Test: `tests/unit/commercial-pricing.test.ts`

- [ ] **Step 1: Write the failing pricing tests**

Create `tests/unit/commercial-pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateGenerationCreditCost } from '@/lib/commercial/pricing'

describe('commercial pricing', () => {
  it('uses fixed root and drill-down prices without membership discount', () => {
    expect(calculateGenerationCreditCost({ taskType: 'root_page', pricing: { rootPageCredits: 12, drillDownCredits: 8 } })).toEqual({
      baseCredits: 12,
      discountRate: 1,
      finalCredits: 12
    })

    expect(calculateGenerationCreditCost({ taskType: 'drill_down', pricing: { rootPageCredits: 12, drillDownCredits: 8 } })).toEqual({
      baseCredits: 8,
      discountRate: 1,
      finalCredits: 8
    })
  })

  it('rounds membership-discounted prices up to whole credits', () => {
    expect(calculateGenerationCreditCost({
      taskType: 'root_page',
      pricing: { rootPageCredits: 11, drillDownCredits: 7 },
      membershipDiscountRate: 0.75
    })).toEqual({
      baseCredits: 11,
      discountRate: 0.75,
      finalCredits: 9
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/commercial-pricing.test.ts`

Expected: FAIL because `@/lib/commercial/pricing` does not exist.

- [ ] **Step 3: Create domain types**

Create `lib/commercial/types.ts`:

```ts
export type LoginType = 'phone' | 'email'
export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'disabled'
export type MembershipStatus = 'active' | 'expired' | 'cancelled'
export type CreditLedgerType = 'credit_pack_purchase' | 'membership_grant' | 'generation_reserve' | 'generation_confirm' | 'generation_refund' | 'admin_adjustment'
export type OrderType = 'membership' | 'credit_pack'
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed'
export type GenerationTaskType = 'root_page' | 'drill_down'
export type GenerationTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'refunded'
export type ChannelAttemptStatus = 'running' | 'succeeded' | 'failed' | 'timed_out'

export type User = {
  id: string
  loginIdentifier: string
  loginType: LoginType
  displayName: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
}

export type MembershipPlan = {
  id: string
  name: string
  priceCents: number
  validityDays: number
  grantCredits: number
  discountRate: number
  taskLimit: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreditAccount = {
  userId: string
  balance: number
  updatedAt: string
}

export type GenerationPricing = {
  rootPageCredits: number
  drillDownCredits: number
}

export type GenerationTask = {
  id: string
  userId: string
  status: GenerationTaskStatus
  taskType: GenerationTaskType
  topic: string | null
  parentPageId: string | null
  style: string
  estimatedCredits: number
  chargedCredits: number
  resultPageId: string | null
  failureReason: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type ModelChannel = {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKeyEncrypted: string
  modelName: string
  weight: number
  timeoutMs: number
  isEnabled: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 4: Create pricing helper**

Create `lib/commercial/pricing.ts`:

```ts
import type { GenerationPricing, GenerationTaskType } from './types'

type CalculateGenerationCreditCostInput = {
  taskType: GenerationTaskType
  pricing: GenerationPricing
  membershipDiscountRate?: number
}

type GenerationCreditCost = {
  baseCredits: number
  discountRate: number
  finalCredits: number
}

export function calculateGenerationCreditCost(input: CalculateGenerationCreditCostInput): GenerationCreditCost {
  const baseCredits = input.taskType === 'root_page' ? input.pricing.rootPageCredits : input.pricing.drillDownCredits
  const discountRate = input.membershipDiscountRate ?? 1

  return {
    baseCredits,
    discountRate,
    finalCredits: Math.ceil(baseCredits * discountRate)
  }
}
```

- [ ] **Step 5: Run the pricing tests**

Run: `npm run test:unit -- tests/unit/commercial-pricing.test.ts`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 3: Credit Ledger Rules

**Files:**
- Create: `lib/commercial/credits.ts`
- Test: `tests/unit/commercial-credits.test.ts`

- [ ] **Step 1: Write the failing credit transition tests**

Create `tests/unit/commercial-credits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyAdminCreditAdjustment, confirmReservedCredits, refundReservedCredits, reserveCredits } from '@/lib/commercial/credits'

describe('credit transitions', () => {
  it('reserves credits by reducing available balance', () => {
    expect(reserveCredits({ balance: 20, amount: 6, taskId: 'task_1' })).toEqual({
      balanceAfter: 14,
      ledger: {
        type: 'generation_reserve',
        amount: -6,
        balanceAfter: 14,
        referenceType: 'generation_task',
        referenceId: 'task_1',
        reason: null
      }
    })
  })

  it('rejects reservations that exceed the balance', () => {
    expect(() => reserveCredits({ balance: 5, amount: 6, taskId: 'task_1' })).toThrow('Insufficient credits')
  })

  it('confirms reserved credits without changing balance again', () => {
    expect(confirmReservedCredits({ balance: 14, amount: 6, taskId: 'task_1' })).toEqual({
      balanceAfter: 14,
      ledger: {
        type: 'generation_confirm',
        amount: 0,
        balanceAfter: 14,
        referenceType: 'generation_task',
        referenceId: 'task_1',
        reason: null
      }
    })
  })

  it('refunds reserved credits on generation failure', () => {
    expect(refundReservedCredits({ balance: 14, amount: 6, taskId: 'task_1' })).toEqual({
      balanceAfter: 20,
      ledger: {
        type: 'generation_refund',
        amount: 6,
        balanceAfter: 20,
        referenceType: 'generation_task',
        referenceId: 'task_1',
        reason: 'generation_failed'
      }
    })
  })

  it('requires a reason for manual admin adjustments', () => {
    expect(() => applyAdminCreditAdjustment({ balance: 10, amount: 5, reason: '' })).toThrow('Admin credit adjustments require a reason')
    expect(applyAdminCreditAdjustment({ balance: 10, amount: 5, reason: 'customer support correction' })).toEqual({
      balanceAfter: 15,
      ledger: {
        type: 'admin_adjustment',
        amount: 5,
        balanceAfter: 15,
        referenceType: 'admin_adjustment',
        referenceId: null,
        reason: 'customer support correction'
      }
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/commercial-credits.test.ts`

Expected: FAIL because `@/lib/commercial/credits` does not exist.

- [ ] **Step 3: Create credit transition helper**

Create `lib/commercial/credits.ts`:

```ts
import type { CreditLedgerType } from './types'

type LedgerDraft = {
  type: CreditLedgerType
  amount: number
  balanceAfter: number
  referenceType: string | null
  referenceId: string | null
  reason: string | null
}

type CreditTransition = {
  balanceAfter: number
  ledger: LedgerDraft
}

function assertNonNegativeBalance(balance: number): void {
  if (balance < 0) throw new Error('Credit balance cannot be negative')
}

export function reserveCredits(input: { balance: number; amount: number; taskId: string }): CreditTransition {
  const balanceAfter = input.balance - input.amount
  if (balanceAfter < 0) throw new Error('Insufficient credits')

  return {
    balanceAfter,
    ledger: {
      type: 'generation_reserve',
      amount: -input.amount,
      balanceAfter,
      referenceType: 'generation_task',
      referenceId: input.taskId,
      reason: null
    }
  }
}

export function confirmReservedCredits(input: { balance: number; amount: number; taskId: string }): CreditTransition {
  assertNonNegativeBalance(input.balance)

  return {
    balanceAfter: input.balance,
    ledger: {
      type: 'generation_confirm',
      amount: 0,
      balanceAfter: input.balance,
      referenceType: 'generation_task',
      referenceId: input.taskId,
      reason: null
    }
  }
}

export function refundReservedCredits(input: { balance: number; amount: number; taskId: string }): CreditTransition {
  const balanceAfter = input.balance + input.amount

  return {
    balanceAfter,
    ledger: {
      type: 'generation_refund',
      amount: input.amount,
      balanceAfter,
      referenceType: 'generation_task',
      referenceId: input.taskId,
      reason: 'generation_failed'
    }
  }
}

export function applyAdminCreditAdjustment(input: { balance: number; amount: number; reason: string }): CreditTransition {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Admin credit adjustments require a reason')

  const balanceAfter = input.balance + input.amount
  assertNonNegativeBalance(balanceAfter)

  return {
    balanceAfter,
    ledger: {
      type: 'admin_adjustment',
      amount: input.amount,
      balanceAfter,
      referenceType: 'admin_adjustment',
      referenceId: null,
      reason
    }
  }
}
```

- [ ] **Step 4: Run the credit tests**

Run: `npm run test:unit -- tests/unit/commercial-credits.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 4: Generation Task State Rules

**Files:**
- Create: `lib/commercial/task-state.ts`
- Test: `tests/unit/task-state.test.ts`

- [ ] **Step 1: Write the failing task-state tests**

Create `tests/unit/task-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canTransitionTask, nextTaskStatus } from '@/lib/commercial/task-state'

describe('generation task state transitions', () => {
  it('allows the commercial task lifecycle', () => {
    expect(canTransitionTask('pending', 'running')).toBe(true)
    expect(canTransitionTask('running', 'succeeded')).toBe(true)
    expect(canTransitionTask('running', 'failed')).toBe(true)
    expect(canTransitionTask('failed', 'refunded')).toBe(true)
  })

  it('rejects invalid lifecycle jumps', () => {
    expect(canTransitionTask('pending', 'succeeded')).toBe(false)
    expect(canTransitionTask('succeeded', 'refunded')).toBe(false)
    expect(canTransitionTask('refunded', 'running')).toBe(false)
  })

  it('throws when calculating an invalid next status', () => {
    expect(nextTaskStatus('pending', 'start')).toBe('running')
    expect(nextTaskStatus('running', 'succeed')).toBe('succeeded')
    expect(nextTaskStatus('running', 'fail')).toBe('failed')
    expect(nextTaskStatus('failed', 'refund')).toBe('refunded')
    expect(() => nextTaskStatus('succeeded', 'refund')).toThrow('Invalid task transition')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/task-state.test.ts`

Expected: FAIL because `@/lib/commercial/task-state` does not exist.

- [ ] **Step 3: Create task-state helper**

Create `lib/commercial/task-state.ts`:

```ts
import type { GenerationTaskStatus } from './types'

type TaskAction = 'start' | 'succeed' | 'fail' | 'refund'

const allowedTransitions: Record<GenerationTaskStatus, GenerationTaskStatus[]> = {
  pending: ['running'],
  running: ['succeeded', 'failed'],
  succeeded: [],
  failed: ['refunded'],
  refunded: []
}

const actionTargets: Record<TaskAction, GenerationTaskStatus> = {
  start: 'running',
  succeed: 'succeeded',
  fail: 'failed',
  refund: 'refunded'
}

export function canTransitionTask(from: GenerationTaskStatus, to: GenerationTaskStatus): boolean {
  return allowedTransitions[from].includes(to)
}

export function nextTaskStatus(from: GenerationTaskStatus, action: TaskAction): GenerationTaskStatus {
  const to = actionTargets[action]
  if (!canTransitionTask(from, to)) throw new Error(`Invalid task transition: ${from} -> ${to}`)
  return to
}
```

- [ ] **Step 4: Run the task-state tests**

Run: `npm run test:unit -- tests/unit/task-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 5: Auth Identity, Session, and Verification Helpers

**Files:**
- Create: `lib/auth/identity.ts`
- Create: `lib/auth/session.ts`
- Create: `lib/auth/verification.ts`
- Test: `tests/unit/auth-identity.test.ts`
- Test: `tests/unit/auth-session.test.ts`
- Test: `tests/unit/auth-verification.test.ts`

- [ ] **Step 1: Write failing identity tests**

Create `tests/unit/auth-identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'

describe('login identity normalization', () => {
  it('normalizes email identifiers', () => {
    expect(normalizeLoginIdentifier('  User@Example.COM ')).toEqual({ loginType: 'email', loginIdentifier: 'user@example.com' })
  })

  it('normalizes phone identifiers', () => {
    expect(normalizeLoginIdentifier(' 138 0013 8000 ')).toEqual({ loginType: 'phone', loginIdentifier: '13800138000' })
  })

  it('rejects invalid identifiers', () => {
    expect(() => normalizeLoginIdentifier('not-valid')).toThrow('Enter a valid phone number or email')
  })
})
```

- [ ] **Step 2: Write failing session tests**

Create `tests/unit/auth-session.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createSessionToken, verifySessionToken } from '@/lib/auth/session'

describe('signed session tokens', () => {
  it('round-trips a valid session token', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'admin' }, 'secret')
    expect(verifySessionToken(token, 'secret')).toEqual({ userId: 'user_1', role: 'admin' })
  })

  it('rejects tampered tokens', () => {
    const token = createSessionToken({ userId: 'user_1', role: 'user' }, 'secret')
    expect(verifySessionToken(`${token}x`, 'secret')).toBeNull()
  })
})
```

- [ ] **Step 3: Write failing verification tests**

Create `tests/unit/auth-verification.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createVerificationCode, hashVerificationCode, isVerificationCodeExpired, verifyCodeHash } from '@/lib/auth/verification'

describe('verification codes', () => {
  it('creates six-digit codes', () => {
    expect(createVerificationCode()).toMatch(/^\d{6}$/)
  })

  it('hashes and verifies codes', () => {
    const hash = hashVerificationCode('123456', 'pepper')
    expect(verifyCodeHash('123456', hash, 'pepper')).toBe(true)
    expect(verifyCodeHash('000000', hash, 'pepper')).toBe(false)
  })

  it('detects expired codes', () => {
    expect(isVerificationCodeExpired(new Date('2026-05-24T00:00:00.000Z'), new Date('2026-05-24T00:00:01.000Z'))).toBe(true)
    expect(isVerificationCodeExpired(new Date('2026-05-24T00:01:00.000Z'), new Date('2026-05-24T00:00:01.000Z'))).toBe(false)
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test:unit -- tests/unit/auth-identity.test.ts tests/unit/auth-session.test.ts tests/unit/auth-verification.test.ts`

Expected: FAIL because the auth helpers do not exist.

- [ ] **Step 5: Create identity helper**

Create `lib/auth/identity.ts`:

```ts
import type { LoginType } from '@/lib/commercial/types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mainlandPhonePattern = /^1\d{10}$/

export function normalizeLoginIdentifier(value: string): { loginType: LoginType; loginIdentifier: string } {
  const trimmed = value.trim()
  const email = trimmed.toLowerCase()
  if (emailPattern.test(email)) return { loginType: 'email', loginIdentifier: email }

  const phone = trimmed.replace(/[\s-]/g, '')
  if (mainlandPhonePattern.test(phone)) return { loginType: 'phone', loginIdentifier: phone }

  throw new Error('Enter a valid phone number or email')
}
```

- [ ] **Step 6: Create session helper**

Create `lib/auth/session.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { UserRole } from '@/lib/commercial/types'

type SessionPayload = {
  userId: string
  role: UserRole
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(payload: SessionPayload, secret = process.env.AUTH_SECRET ?? 'dev-secret'): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded, secret)}`
}

export function verifySessionToken(token: string, secret = process.env.AUTH_SECRET ?? 'dev-secret'): SessionPayload | null {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const expected = sign(encoded, secret)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (!payload.userId || (payload.role !== 'user' && payload.role !== 'admin')) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 7: Create verification helper**

Create `lib/auth/verification.ts`:

```ts
import { createHash, randomInt } from 'node:crypto'

export function createVerificationCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, '0')
}

export function hashVerificationCode(code: string, pepper = process.env.AUTH_SECRET ?? 'dev-secret'): string {
  return createHash('sha256').update(`${code}:${pepper}`).digest('hex')
}

export function verifyCodeHash(code: string, hash: string, pepper = process.env.AUTH_SECRET ?? 'dev-secret'): boolean {
  return hashVerificationCode(code, pepper) === hash
}

export function isVerificationCodeExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function createVerificationExpiry(now = new Date(), ttlMinutes = 10): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000)
}
```

- [ ] **Step 8: Run the auth helper tests**

Run: `npm run test:unit -- tests/unit/auth-identity.test.ts tests/unit/auth-session.test.ts tests/unit/auth-verification.test.ts`

Expected: PASS.

- [ ] **Step 9: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 6: Commercial Store Helpers

**Files:**
- Create: `lib/commercial/store.ts`
- Test: `tests/unit/commercial-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `tests/unit/commercial-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('@/lib/db', () => ({ query: queryMock }))

describe('commercial store', () => {
  beforeEach(() => queryMock.mockReset())

  it('finds a user by login identifier', async () => {
    const { findUserByLoginIdentifier } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'user_1', login_identifier: 'a@example.com', login_type: 'email', display_name: null, role: 'user', status: 'active', created_at: '2026-05-24T00:00:00.000Z', updated_at: '2026-05-24T00:00:00.000Z' }] })

    await expect(findUserByLoginIdentifier('a@example.com')).resolves.toEqual({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', displayName: null, role: 'user', status: 'active', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('from users'), ['a@example.com'])
  })

  it('creates a user and credit account in a transaction', async () => {
    const { createUserWithCreditAccount } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValue({ rows: [] })

    await createUserWithCreditAccount({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', role: 'user', now: '2026-05-24T00:00:00.000Z' })

    expect(queryMock).toHaveBeenNthCalledWith(1, 'begin')
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into users'), expect.arrayContaining(['user_1', 'a@example.com', 'email', 'user']))
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into credit_accounts'), ['user_1', 0, '2026-05-24T00:00:00.000Z'])
    expect(queryMock).toHaveBeenLastCalledWith('commit')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/commercial-store.test.ts`

Expected: FAIL because `@/lib/commercial/store` does not exist.

- [ ] **Step 3: Create store helpers**

Create `lib/commercial/store.ts`:

```ts
import { query } from '@/lib/db'
import type { LoginType, User, UserRole } from './types'

type UserRow = {
  id: string
  login_identifier: string
  login_type: LoginType
  display_name: string | null
  role: UserRole
  status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    loginIdentifier: row.login_identifier,
    loginType: row.login_type,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function findUserByLoginIdentifier(loginIdentifier: string): Promise<User | null> {
  const result = await query<UserRow>(
    `select id, login_identifier, login_type, display_name, role, status, created_at, updated_at
     from users
     where login_identifier = $1`,
    [loginIdentifier]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function createUserWithCreditAccount(input: { id: string; loginIdentifier: string; loginType: LoginType; role: UserRole; now: string }): Promise<void> {
  await query('begin')
  try {
    await query(
      `insert into users (id, login_identifier, login_type, display_name, role, status, created_at, updated_at)
       values ($1, $2, $3, null, $4, 'active', $5, $5)`,
      [input.id, input.loginIdentifier, input.loginType, input.role, input.now]
    )
    await query(
      `insert into credit_accounts (user_id, balance, updated_at)
       values ($1, $2, $3)`,
      [input.id, 0, input.now]
    )
    await query('commit')
  } catch (error) {
    await query('rollback')
    throw error
  }
}
```

- [ ] **Step 4: Run the store tests**

Run: `npm run test:unit -- tests/unit/commercial-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 7: Auth API Routes and Login Page Shell

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/api/auth/request-code/route.ts`
- Create: `app/api/auth/verify-code/route.ts`
- Test: `tests/integration/auth-routes.test.ts`

- [ ] **Step 1: Write failing auth route tests**

Create `tests/integration/auth-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/commercial/store', () => ({
  createUserWithCreditAccount: vi.fn(async () => undefined),
  findUserByLoginIdentifier: vi.fn(async () => null)
}))

describe('auth routes', () => {
  it('request-code rejects invalid login identifiers', async () => {
    const { POST } = await import('@/app/api/auth/request-code/route')
    const response = await POST(new Request('http://test.local/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'not-valid' })
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请输入有效手机号或邮箱。' })
  })

  it('request-code accepts valid identifiers', async () => {
    const { POST } = await import('@/app/api/auth/request-code/route')
    const response = await POST(new Request('http://test.local/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ loginIdentifier: 'user@example.com' })
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:integration -- tests/integration/auth-routes.test.ts`

Expected: FAIL because the auth routes do not exist.

- [ ] **Step 3: Create login page shell**

Create `app/login/page.tsx`:

```tsx
export default function LoginPage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>登录 FollowVine</h1>
        <p>使用手机号或邮箱验证码登录，管理你的会员、积分和生成作品。</p>
        <form className="prompt-card">
          <label className="field-label">
            <span>手机号或邮箱</span>
            <input name="loginIdentifier" aria-label="手机号或邮箱" placeholder="user@example.com" />
          </label>
          <label className="field-label">
            <span>验证码</span>
            <input name="code" aria-label="验证码" placeholder="六位验证码" />
          </label>
          <button className="primary-button" type="submit">登录</button>
        </form>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Create request-code route**

Create `app/api/auth/request-code/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'
import { createVerificationCode } from '@/lib/auth/verification'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { loginIdentifier?: unknown } | null

  try {
    normalizeLoginIdentifier(String(body?.loginIdentifier ?? ''))
  } catch {
    return NextResponse.json({ error: '请输入有效手机号或邮箱。' }, { status: 400 })
  }

  createVerificationCode()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Create verify-code route shell**

Create `app/api/auth/verify-code/route.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'
import { createSessionToken } from '@/lib/auth/session'
import { createUserWithCreditAccount, findUserByLoginIdentifier } from '@/lib/commercial/store'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { loginIdentifier?: unknown; code?: unknown } | null

  let identity: ReturnType<typeof normalizeLoginIdentifier>
  try {
    identity = normalizeLoginIdentifier(String(body?.loginIdentifier ?? ''))
  } catch {
    return NextResponse.json({ error: '请输入有效手机号或邮箱。' }, { status: 400 })
  }

  const code = String(body?.code ?? '')
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: '请输入六位验证码。' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let user = await findUserByLoginIdentifier(identity.loginIdentifier)
  if (!user) {
    const userId = `user_${randomUUID().replace(/-/g, '')}`
    await createUserWithCreditAccount({ id: userId, loginIdentifier: identity.loginIdentifier, loginType: identity.loginType, role: 'user', now })
    user = await findUserByLoginIdentifier(identity.loginIdentifier)
  }

  if (!user) return NextResponse.json({ error: '登录失败，请稍后再试。' }, { status: 502 })

  const cookieStore = await cookies()
  cookieStore.set('fv_session', createSessionToken({ userId: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Run auth route tests**

Run: `npm run test:integration -- tests/integration/auth-routes.test.ts`

Expected: PASS.

- [ ] **Step 7: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 8: Admin Permissions and Admin Shell

**Files:**
- Create: `lib/auth/permissions.ts`
- Create: `components/admin/AdminNav.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/users/page.tsx`
- Create: `app/admin/orders/page.tsx`
- Create: `app/admin/membership/page.tsx`
- Create: `app/admin/model-channels/page.tsx`
- Create: `app/admin/tasks/page.tsx`
- Create: `app/admin/settings/page.tsx`
- Test: `tests/unit/auth-permissions.test.ts`

- [ ] **Step 1: Write failing permissions tests**

Create `tests/unit/auth-permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canAccessAdmin } from '@/lib/auth/permissions'

describe('admin permissions', () => {
  it('allows active admins only', () => {
    expect(canAccessAdmin({ role: 'admin', status: 'active' })).toBe(true)
    expect(canAccessAdmin({ role: 'user', status: 'active' })).toBe(false)
    expect(canAccessAdmin({ role: 'admin', status: 'disabled' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/auth-permissions.test.ts`

Expected: FAIL because `@/lib/auth/permissions` does not exist.

- [ ] **Step 3: Create permissions helper**

Create `lib/auth/permissions.ts`:

```ts
import type { UserRole, UserStatus } from '@/lib/commercial/types'

export function canAccessAdmin(user: { role: UserRole; status: UserStatus } | null): boolean {
  return user?.role === 'admin' && user.status === 'active'
}
```

- [ ] **Step 4: Create admin navigation**

Create `components/admin/AdminNav.tsx`:

```tsx
import Link from 'next/link'

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/orders', label: 'Orders & Credits' },
  { href: '/admin/membership', label: 'Membership' },
  { href: '/admin/model-channels', label: 'Model Channels' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/settings', label: 'Settings' }
]

export function AdminNav() {
  return (
    <nav className="history-strip" aria-label="Admin navigation">
      {adminLinks.map((link) => (
        <Link key={link.href} href={link.href}>{link.label}</Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Create admin layout and pages**

Create `app/admin/layout.tsx`:

```tsx
import { AdminNav } from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>Admin Console</h1>
        <p>Manage users, credits, orders, memberships, model channels, generation tasks, and system settings.</p>
        <AdminNav />
      </section>
      <section className="workspace-panel">{children}</section>
    </main>
  )
}
```

Create `app/admin/page.tsx`:

```tsx
export default function AdminDashboardPage() {
  return <h2>Operations dashboard</h2>
}
```

Create `app/admin/users/page.tsx`:

```tsx
export default function AdminUsersPage() {
  return <h2>User management</h2>
}
```

Create `app/admin/orders/page.tsx`:

```tsx
export default function AdminOrdersPage() {
  return <h2>Orders and credit ledger</h2>
}
```

Create `app/admin/membership/page.tsx`:

```tsx
export default function AdminMembershipPage() {
  return <h2>Membership plans and credit packs</h2>
}
```

Create `app/admin/model-channels/page.tsx`:

```tsx
export default function AdminModelChannelsPage() {
  return <h2>Model channel management</h2>
}
```

Create `app/admin/tasks/page.tsx`:

```tsx
export default function AdminTasksPage() {
  return <h2>Generation task management</h2>
}
```

Create `app/admin/settings/page.tsx`:

```tsx
export default function AdminSettingsPage() {
  return <h2>System settings</h2>
}
```

- [ ] **Step 6: Run permissions tests and typecheck**

Run: `npm run test:unit -- tests/unit/auth-permissions.test.ts && npm run typecheck`

Expected: PASS for the permissions test and no TypeScript errors.

- [ ] **Step 7: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 9: Logged-In Workspace and Account Shell

**Files:**
- Create: `app/workspace/page.tsx`
- Create: `app/account/page.tsx`
- Test: `tests/e2e/commercial-shell.spec.ts`

- [ ] **Step 1: Write failing browser shell tests**

Create `tests/e2e/commercial-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('commercial workspace shell is available', async ({ page }) => {
  await page.goto('/workspace')
  await expect(page.getByRole('heading', { name: 'FollowVine Workspace' })).toBeVisible()
  await expect(page.getByText('余额与预估消耗')).toBeVisible()
})

test('account shell shows commercial account sections', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account & Balance' })).toBeVisible()
  await expect(page.getByText('会员状态')).toBeVisible()
  await expect(page.getByText('积分流水')).toBeVisible()
})
```

- [ ] **Step 2: Run the browser tests to verify they fail**

Run: `npm run test:e2e -- tests/e2e/commercial-shell.spec.ts`

Expected: FAIL because `/workspace` and `/account` do not exist.

- [ ] **Step 3: Create workspace shell**

Create `app/workspace/page.tsx`:

```tsx
export default function WorkspacePage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>FollowVine Workspace</h1>
        <p>生成可下钻的中文图解路径，并在创建任务前查看余额与预估消耗。</p>
        <div className="prompt-card">
          <label className="field-label">
            <span>知识主题</span>
            <input aria-label="知识主题" placeholder="比如：RAG 是怎么工作的" />
          </label>
          <div className="field-label">
            <span>余额与预估消耗</span>
            <strong>当前余额 0 积分 · 本次预计 0 积分</strong>
          </div>
          <button className="primary-button" type="button">创建生成任务</button>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Create account shell**

Create `app/account/page.tsx`:

```tsx
export default function AccountPage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>Account & Balance</h1>
        <p>查看会员状态、积分余额、订单记录和积分流水。</p>
      </section>
      <section className="explainer-viewer">
        <h2>会员状态</h2>
        <p>当前未开通会员。</p>
      </section>
      <section className="explainer-viewer">
        <h2>积分流水</h2>
        <p>暂无积分流水。</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Run the commercial shell browser tests**

Run: `npm run test:e2e -- tests/e2e/commercial-shell.spec.ts`

Expected: PASS. If an existing dev server is already using port 3100, stop that local server after confirming with the user, then rerun.

- [ ] **Step 6: Checkpoint**

Run: `git status --short`. Do not commit unless the user explicitly authorizes commits for this implementation session.

## Task 10: Full Foundation Verification

**Files:**
- No new files.

- [ ] **Step 1: Run unit tests for new foundation modules**

Run:

```bash
npm run test:unit -- tests/unit/commercial-schema.test.ts tests/unit/commercial-pricing.test.ts tests/unit/commercial-credits.test.ts tests/unit/task-state.test.ts tests/unit/auth-identity.test.ts tests/unit/auth-session.test.ts tests/unit/auth-verification.test.ts tests/unit/auth-permissions.test.ts tests/unit/commercial-store.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run integration auth route tests**

Run: `npm run test:integration -- tests/integration/auth-routes.test.ts`

Expected: PASS.

- [ ] **Step 3: Run TypeScript checks**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run commercial shell browser tests**

Run: `npm run test:e2e -- tests/e2e/commercial-shell.spec.ts`

Expected: PASS. If a manually started dev server is occupying port 3100, ask before stopping it.

- [ ] **Step 5: Run the existing test suite**

Run: `npm run test`

Expected: all existing Vitest tests pass.

- [ ] **Step 6: Review changed files**

Run: `git status --short` and `git diff --stat`.

Expected: changes are limited to the commercial foundation files listed in this plan plus any ignored local Playwright artifacts.

## Coverage Map

- Commercial schema: Task 1
- User/login foundation: Tasks 5, 6, 7
- Membership/credit/order foundations: Tasks 1, 2, 3, 6
- Generation task foundation: Tasks 1, 4
- Model-channel foundation: Task 1 schema and Task 8 admin shell
- Admin shell: Task 8
- Logged-in user shell: Task 9
- Verification: Task 10

## Not Covered by This Plan

These are commercial MVP requirements, but they belong in follow-up plans:

- Z-Pay / 易支付 order creation and callback verification
- Paid-order fulfillment and membership grant jobs
- Real verification-code delivery provider integration
- Async image task worker
- Weighted model-channel selection and channel retry execution
- Credit reservation tied to real generation tasks
- Pricing/recharge page
- Template and case library
- SEO content pages
- Commercial homepage redesign
