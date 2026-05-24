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

function assertPositiveAmount(amount: number): void {
  if (amount <= 0) throw new Error('Credit amount must be positive')
}

export function reserveCredits(input: { balance: number; amount: number; taskId: string }): CreditTransition {
  assertNonNegativeBalance(input.balance)
  assertPositiveAmount(input.amount)

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
  assertPositiveAmount(input.amount)

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
  assertNonNegativeBalance(input.balance)
  assertPositiveAmount(input.amount)

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
  assertNonNegativeBalance(input.balance)

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
