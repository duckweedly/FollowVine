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
  if (input.pricing.rootPageCredits <= 0 || input.pricing.drillDownCredits <= 0) {
    throw new Error('Generation credit prices must be positive')
  }

  const baseCredits = input.taskType === 'root_page' ? input.pricing.rootPageCredits : input.pricing.drillDownCredits
  const discountRate = input.membershipDiscountRate ?? 1

  if (discountRate <= 0 || discountRate > 1) {
    throw new Error('Membership discount rate must be between 0 and 1')
  }

  return {
    baseCredits,
    discountRate,
    finalCredits: Math.ceil(baseCredits * discountRate)
  }
}
