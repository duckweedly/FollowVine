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

  it('rejects non-positive generation credit prices', () => {
    expect(() => calculateGenerationCreditCost({
      taskType: 'root_page',
      pricing: { rootPageCredits: 0, drillDownCredits: 7 }
    })).toThrow('Generation credit prices must be positive')

    expect(() => calculateGenerationCreditCost({
      taskType: 'drill_down',
      pricing: { rootPageCredits: 11, drillDownCredits: -1 }
    })).toThrow('Generation credit prices must be positive')
  })

  it('rejects membership discount rates outside the allowed range', () => {
    expect(() => calculateGenerationCreditCost({
      taskType: 'root_page',
      pricing: { rootPageCredits: 11, drillDownCredits: 7 },
      membershipDiscountRate: 0
    })).toThrow('Membership discount rate must be between 0 and 1')

    expect(() => calculateGenerationCreditCost({
      taskType: 'root_page',
      pricing: { rootPageCredits: 11, drillDownCredits: 7 },
      membershipDiscountRate: 1.01
    })).toThrow('Membership discount rate must be between 0 and 1')
  })
})
