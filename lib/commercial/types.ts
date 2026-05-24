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
