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

  it('rejects reservations with zero or negative credit amounts', () => {
    expect(() => reserveCredits({ balance: 5, amount: 0, taskId: 'task_1' })).toThrow('Credit amount must be positive')
    expect(() => reserveCredits({ balance: 5, amount: -1, taskId: 'task_1' })).toThrow('Credit amount must be positive')
  })

  it('rejects reservations from negative starting balances', () => {
    expect(() => reserveCredits({ balance: -1, amount: 1, taskId: 'task_1' })).toThrow('Credit balance cannot be negative')
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

  it('rejects confirmations with negative credit amounts', () => {
    expect(() => confirmReservedCredits({ balance: 14, amount: -1, taskId: 'task_1' })).toThrow('Credit amount must be positive')
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

  it('rejects refunds with negative credit amounts', () => {
    expect(() => refundReservedCredits({ balance: 14, amount: -1, taskId: 'task_1' })).toThrow('Credit amount must be positive')
  })

  it('rejects refunds from negative starting balances', () => {
    expect(() => refundReservedCredits({ balance: -1, amount: 1, taskId: 'task_1' })).toThrow('Credit balance cannot be negative')
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

  it('rejects admin adjustments from negative starting balances', () => {
    expect(() => applyAdminCreditAdjustment({ balance: -1, amount: 1, reason: 'chargeback correction' })).toThrow(
      'Credit balance cannot be negative'
    )
  })

  it('rejects admin adjustments that would make the balance negative', () => {
    expect(() => applyAdminCreditAdjustment({ balance: 10, amount: -11, reason: 'chargeback correction' })).toThrow(
      'Credit balance cannot be negative'
    )
  })
})
